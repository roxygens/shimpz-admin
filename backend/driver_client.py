"""Bounded authenticated HTTP transport from Admin to team-driver."""

from __future__ import annotations

import http.client
import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

import modelproviders

log = logging.getLogger("shimpz-admin")

URL = os.environ.get("SHIMPZ_TEAMDRIVER_URL", "http://team-driver:7077")
TOKEN_FILE = os.environ.get("SHIMPZ_TEAMDRIVER_TOKEN_FILE", "/run/shimpz-teamdriver/token")

MAX_JSON_BODY_BYTES = 16 * 1024
MAX_JSON_RESPONSE_BYTES = 256 * 1024
CONTROL_TIMEOUT_SECONDS = 180


class TeamRequestError(ValueError):
    """The browser supplied an invalid id or request body; no driver call was made."""


@dataclass(frozen=True)
class DriverResponse:
    status: int
    body: dict[str, object]


def _encode_payload(payload: object | None, *, max_bytes: int = MAX_JSON_BODY_BYTES) -> bytes | None:
    if payload is None:
        return None
    if not isinstance(payload, dict):
        raise TeamRequestError("request body must be a JSON object")
    try:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode("utf-8")
    except (TypeError, ValueError, UnicodeError, RecursionError) as exc:
        raise TeamRequestError("request body must be valid JSON") from exc
    if len(body) > max_bytes:
        raise TeamRequestError(f"request body exceeds {max_bytes} bytes")
    return body


def _endpoint() -> tuple[str, int]:
    try:
        parsed = urlparse(URL)
    except ValueError as exc:
        raise OSError("invalid team-driver endpoint") from exc
    if (
        parsed.scheme != "http"
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.path not in {"", "/"}
        or parsed.params
        or parsed.query
        or parsed.fragment
    ):
        raise OSError("invalid team-driver endpoint")
    try:
        return parsed.hostname, parsed.port or 7077
    except ValueError as exc:
        raise OSError("invalid team-driver endpoint") from exc


def _decode_response(response: http.client.HTTPResponse) -> dict[str, object]:
    if response.status == 204:
        raw_length = response.getheader("Content-Length")
        if raw_length not in {None, "0"} or response.read(1):
            raise OSError("invalid team-driver response")
        return {}

    content_type = (response.getheader("Content-Type") or "").partition(";")[0].strip().lower()
    if content_type != "application/json":
        raise OSError("invalid team-driver response")

    raw_length = response.getheader("Content-Length")
    if raw_length is not None:
        try:
            length = int(raw_length)
        except ValueError as exc:
            raise OSError("invalid team-driver response") from exc
        if length < 0 or length > MAX_JSON_RESPONSE_BYTES:
            raise OSError("invalid team-driver response")

    raw = response.read(MAX_JSON_RESPONSE_BYTES + 1)
    if len(raw) > MAX_JSON_RESPONSE_BYTES:
        raise OSError("invalid team-driver response")
    if not raw:
        return {}
    try:
        body = json.loads(raw)
    except (json.JSONDecodeError, UnicodeError, RecursionError) as exc:
        raise OSError("invalid team-driver response") from exc
    if not isinstance(body, dict):
        raise OSError("invalid team-driver response")
    return body


def _call(
    method: str,
    path: str,
    payload: object | None = None,
    *,
    timeout: int = CONTROL_TIMEOUT_SECONDS,
    max_body_bytes: int = MAX_JSON_BODY_BYTES,
    model_credential: tuple[str, str] | None = None,
) -> DriverResponse:
    body = _encode_payload(payload, max_bytes=max_body_bytes)
    connection = None
    try:
        host, port = _endpoint()
        token = Path(TOKEN_FILE).read_text(encoding="utf-8").strip()
        if not token:
            raise OSError("empty team-driver bearer")
        headers = {"Accept": "application/json", "Authorization": f"Bearer {token}"}
        if body is not None:
            headers["Content-Type"] = "application/json"
        if model_credential is not None:
            provider, api_key = model_credential
            encoded_key = api_key.encode("ascii") if isinstance(api_key, str) and api_key.isascii() else b""
            if (
                provider not in modelproviders.PROVIDERS
                or not 16 <= len(encoded_key) <= 8 * 1024
                or any(not 33 <= byte <= 126 for byte in encoded_key)
            ):
                raise OSError("invalid private model credential")
            # Private Admin -> local controller hand-off. These headers never come from browser
            # input, never enter a Team payload, and are never included in this module's logs.
            headers["X-Shimpz-Model-Provider"] = provider
            headers["X-Shimpz-Model-Api-Key"] = api_key
        connection = http.client.HTTPConnection(host, port, timeout=timeout)
        connection.request(method, path, body=body, headers=headers)
        response = connection.getresponse()
        if not 200 <= response.status <= 599:
            raise OSError("invalid team-driver status")
        result = DriverResponse(response.status, _decode_response(response))
    except OSError, UnicodeError, http.client.HTTPException:
        # Exception text, bearer and bodies may contain internals. Never copy them into logs or JSON.
        log.warning("team-driver request failed (%s)", method)
        return DriverResponse(502, {"detail": "team-driver unavailable"})
    finally:
        if connection is not None:
            try:
                connection.close()
            except OSError:
                log.warning("team-driver connection close failed (%s)", method)

    log.info("team-driver %s %s -> HTTP %s", method, path, result.status)
    return result
