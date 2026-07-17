"""Secret-safe local chat orchestration for the Admin backend.

The browser contract is always ``assistant/message/files``. This backend reads the selected
provider from controller-owned inference metadata, resolves its API key from ``admin.json`` through
the non-route ``modelproviders.resolve_api_key``, then delivers it only in fixed private headers on
the authenticated control network. Successful and failed controller responses are reprojected so a
buggy controller can never echo that key back to the browser.
"""

from __future__ import annotations

from http import HTTPStatus

import capsules
import modelproviders

_MISSING_RUNTIME_STATUSES = frozenset({HTTPStatus.NOT_FOUND, HTTPStatus.METHOD_NOT_ALLOWED, HTTPStatus.NOT_IMPLEMENTED})
MAX_REPLY_CHARS = 64 * 1024


def _unavailable() -> capsules.DriverResponse:
    return capsules.DriverResponse(
        HTTPStatus.SERVICE_UNAVAILABLE,
        {"detail": "local chat runtime is unavailable; update this Shimpz Space"},
    )


def _safe_error(response: capsules.DriverResponse, *, secret: str | None = None) -> capsules.DriverResponse:
    detail = response.body.get("detail") or response.body.get("error")
    if not isinstance(detail, str) or not 0 < len(detail) <= 500 or (secret and secret in detail):
        detail = "local chat request failed"
    return capsules.DriverResponse(response.status, {"detail": detail})


def _inference(capsule_id: str) -> tuple[str, str] | capsules.DriverResponse:
    response = capsules.get_inference(capsule_id)
    if response.status in _MISSING_RUNTIME_STATUSES:
        return _unavailable()
    if not 200 <= response.status < 300:
        return _safe_error(response)
    provider = response.body.get("provider")
    model = response.body.get("model")
    try:
        provider = modelproviders.canonical_provider(provider)
    except modelproviders.ModelProviderError:
        return capsules.DriverResponse(HTTPStatus.BAD_GATEWAY, {"detail": "Capsule inference response is invalid"})
    if not isinstance(model, str) or capsules._MODEL_RE.fullmatch(model) is None:
        return capsules.DriverResponse(HTTPStatus.BAD_GATEWAY, {"detail": "Capsule inference response is invalid"})
    return provider, model


def turn(capsule_id: object, payload: object) -> capsules.DriverResponse:
    cid = capsules.canonical_capsule_id(capsule_id)
    body = capsules.canonical_chat_payload(payload)
    inference = _inference(cid)
    if isinstance(inference, capsules.DriverResponse):
        return inference
    provider, _model = inference
    try:
        api_key = modelproviders.resolve_api_key(provider)
    except modelproviders.ModelProviderError:
        return capsules.DriverResponse(HTTPStatus.BAD_GATEWAY, {"detail": "model credential store is invalid"})
    if api_key is None:
        return capsules.DriverResponse(
            HTTPStatus.CONFLICT,
            {"detail": f"add a {provider} API key before chatting"},
        )

    response = capsules.chat(cid, body, provider=provider, api_key=api_key)
    if response.status in _MISSING_RUNTIME_STATUSES:
        return _unavailable()
    if not 200 <= response.status < 300:
        return _safe_error(response, secret=api_key)

    assistant = response.body.get("assistant")
    reply = response.body.get("reply")
    power = response.body.get("power")
    if (
        assistant != body["assistant"]
        or not isinstance(reply, str)
        or not 0 < len(reply) <= MAX_REPLY_CHARS
        or api_key in reply
        or (power is not None and (not isinstance(power, str) or _valid_power(power) is None))
    ):
        return capsules.DriverResponse(HTTPStatus.BAD_GATEWAY, {"detail": "local chat response is invalid"})
    return capsules.DriverResponse(
        response.status,
        {"assistant": assistant, "reply": reply, "power": power},
    )


def _valid_power(value: str) -> str | None:
    try:
        return capsules._canonical_id(value, field="power id", pattern=capsules._POWER_ID_RE, maximum=80)
    except capsules.CapsuleRequestError:
        return None


def stop(capsule_id: object) -> capsules.DriverResponse:
    cid = capsules.canonical_capsule_id(capsule_id)
    response = capsules.stop_chat(cid)
    if response.status in _MISSING_RUNTIME_STATUSES:
        return _unavailable()
    if not 200 <= response.status < 300:
        return _safe_error(response)
    stopped = response.body.get("stopped")
    if not isinstance(stopped, bool):
        return capsules.DriverResponse(HTTPStatus.BAD_GATEWAY, {"detail": "local chat stop response is invalid"})
    return capsules.DriverResponse(response.status, {"capsule": cid, "stopped": stopped})
