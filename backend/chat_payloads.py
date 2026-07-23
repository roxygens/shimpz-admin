"""Fail-closed canonicalizers for Admin chat request payloads."""

from __future__ import annotations

import math
import re

import team_driver_contract
from driver_client import TeamRequestError

_FILE_ID_RE = team_driver_contract.FILE_ID_RE
_CHALLENGE_ID_RE = re.compile(r"^[0-9a-f]{32}$")
MAX_CHAT_MESSAGE_CHARS = team_driver_contract.MAX_CHAT_MESSAGE_CHARS
MAX_CHAT_FILES = team_driver_contract.MAX_CHAT_FILES
MAX_CHAT_ASSISTANTS = team_driver_contract.MAX_CHAT_ASSISTANTS
MAX_SECRET_SUBMISSIONS = 64
MAX_ASSISTANT_SECRET_BYTES = 16 * 1024


def canonical_assistant_id(value: object) -> str:
    canonical = team_driver_contract.canonical_assistant_id(value)
    if canonical is None:
        raise TeamRequestError("assistant id must be a canonical lowercase identifier")
    return canonical


def canonical_challenge_id(value: object) -> str:
    if not isinstance(value, str) or _CHALLENGE_ID_RE.fullmatch(value) is None:
        raise TeamRequestError("OAuth challenge is invalid")
    return value


def canonical_chat_payload(payload: object) -> dict[str, object]:
    """Validate one explicit Assistant scope without treating an empty scope as all."""
    if not isinstance(payload, dict) or set(payload) != {"message", "files", "assistant_ids"}:
        raise TeamRequestError("chat requires message, files, and assistant_ids")
    message = payload["message"]
    if not isinstance(message, str) or not (message := message.strip()):
        raise TeamRequestError("message must be non-empty")
    if len(message) > MAX_CHAT_MESSAGE_CHARS:
        raise TeamRequestError(f"message exceeds {MAX_CHAT_MESSAGE_CHARS} characters")
    files = payload["files"]
    if not isinstance(files, list) or len(files) > MAX_CHAT_FILES:
        raise TeamRequestError(f"files must contain at most {MAX_CHAT_FILES} ids")
    canonical_files = [_canonical_id(item, field="file id", pattern=_FILE_ID_RE, maximum=32) for item in files]
    if len(set(canonical_files)) != len(canonical_files):
        raise TeamRequestError("files must not contain duplicate ids")
    assistant_ids = payload["assistant_ids"]
    if not isinstance(assistant_ids, list) or len(assistant_ids) > MAX_CHAT_ASSISTANTS:
        raise TeamRequestError(f"assistant_ids must contain at most {MAX_CHAT_ASSISTANTS} ids")
    canonical_assistant_ids = [canonical_assistant_id(item) for item in assistant_ids]
    if len(set(canonical_assistant_ids)) != len(canonical_assistant_ids):
        raise TeamRequestError("assistant_ids must not contain duplicate ids")
    return {
        "message": message,
        "files": canonical_files,
        "assistant_ids": canonical_assistant_ids,
    }


def _canonical_id(value: object, *, field: str, pattern: re.Pattern[str], maximum: int) -> str:
    if not isinstance(value, str) or not value or len(value) > maximum or not pattern.fullmatch(value):
        raise TeamRequestError(f"{field} must be a canonical lowercase identifier")
    return value


def canonical_secret_submission(payload: object) -> dict[str, object]:
    """Validate a one-use JIT submission without retaining or logging its values."""
    if not isinstance(payload, dict) or set(payload) != {"challenge_id", "values"}:
        raise TeamRequestError("secret submission requires challenge_id and values")
    challenge_id = payload["challenge_id"]
    values = payload["values"]
    if not isinstance(challenge_id, str) or _CHALLENGE_ID_RE.fullmatch(challenge_id) is None:
        raise TeamRequestError("secret challenge is invalid")
    if not isinstance(values, list) or not 1 <= len(values) <= MAX_SECRET_SUBMISSIONS:
        raise TeamRequestError("secret values exceed their fixed limit")
    canonical: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for item in values:
        if not isinstance(item, dict) or set(item) != {"assistant_id", "secret_id", "value"}:
            raise TeamRequestError("secret value has an invalid shape")
        assistant_id = canonical_assistant_id(item["assistant_id"])
        secret_id = canonical_assistant_id(item["secret_id"])
        value = item["value"]
        if not isinstance(value, str) or not value or value != value.strip() or not value.isprintable():
            raise TeamRequestError("secret value is invalid")
        try:
            encoded = value.encode("utf-8")
        except UnicodeError as exc:
            raise TeamRequestError("secret value is invalid") from exc
        if len(encoded) > MAX_ASSISTANT_SECRET_BYTES:
            raise TeamRequestError("secret value exceeds its fixed limit")
        identity = (assistant_id, secret_id)
        if identity in seen:
            raise TeamRequestError("secret values must not contain duplicates")
        seen.add(identity)
        canonical.append({"assistant_id": assistant_id, "secret_id": secret_id, "value": value})
    return {"challenge_id": challenge_id, "values": canonical}


def canonical_secret_replacement(payload: object) -> dict[str, object]:
    """Validate one atomic Assistant credential replacement without retaining its values."""
    if not isinstance(payload, dict) or set(payload) != {"assistant_id", "values"}:
        raise TeamRequestError("secret replacement requires assistant_id and values")
    assistant_id = canonical_assistant_id(payload["assistant_id"])
    values = payload["values"]
    if not isinstance(values, list) or not 1 <= len(values) <= MAX_SECRET_SUBMISSIONS:
        raise TeamRequestError("secret values exceed their fixed limit")
    canonical: list[dict[str, str]] = []
    seen: set[str] = set()
    for item in values:
        if not isinstance(item, dict) or set(item) != {"secret_id", "value"}:
            raise TeamRequestError("secret value has an invalid shape")
        secret_id = canonical_assistant_id(item["secret_id"])
        value = item["value"]
        if not isinstance(value, str) or not value or value != value.strip() or not value.isprintable():
            raise TeamRequestError("secret value is invalid")
        try:
            encoded = value.encode("utf-8")
        except UnicodeError as exc:
            raise TeamRequestError("secret value is invalid") from exc
        if len(encoded) > MAX_ASSISTANT_SECRET_BYTES:
            raise TeamRequestError("secret value exceeds its fixed limit")
        if secret_id in seen:
            raise TeamRequestError("secret values must not contain duplicates")
        seen.add(secret_id)
        canonical.append({"secret_id": secret_id, "value": value})
    return {"assistant_id": assistant_id, "values": canonical}


def canonical_approval_submission(payload: object) -> dict[str, object]:
    """Accept only an explicit approval of one exact pending challenge."""
    if not isinstance(payload, dict) or set(payload) != {"challenge_id", "approved"}:
        raise TeamRequestError("approval submission requires challenge_id and approved")
    challenge_id = payload["challenge_id"]
    if not isinstance(challenge_id, str) or _CHALLENGE_ID_RE.fullmatch(challenge_id) is None:
        raise TeamRequestError("approval challenge is invalid")
    if payload["approved"] is not True:
        raise TeamRequestError("approval must be explicit")
    return {"challenge_id": challenge_id, "approved": True}


def canonical_input_submission(payload: object) -> dict[str, object]:
    """Accept the bounded JSON union supported by ctx.human.request."""
    if not isinstance(payload, dict) or set(payload) != {"challenge_id", "answer"}:
        raise TeamRequestError("input submission requires challenge_id and answer")
    challenge_id = payload["challenge_id"]
    if not isinstance(challenge_id, str) or _CHALLENGE_ID_RE.fullmatch(challenge_id) is None:
        raise TeamRequestError("input challenge is invalid")
    answer = payload["answer"]
    if isinstance(answer, str):
        valid = len(answer) <= 4096 and "\0" not in answer
    elif type(answer) is int:
        valid = True
    elif type(answer) is float:
        valid = math.isfinite(answer)
    elif type(answer) is bool:
        valid = True
    elif isinstance(answer, list):
        valid = (
            len(answer) <= 64
            and all(isinstance(item, str) and len(item) <= 200 and "\0" not in item for item in answer)
            and len(answer) == len(set(answer))
        )
    else:
        valid = False
    if not valid:
        raise TeamRequestError("input answer is invalid")
    return {"challenge_id": challenge_id, "answer": answer}


def canonical_account_resume(payload: object) -> dict[str, str]:
    """Bind continuation to the one exact controller-owned account challenge."""
    if not isinstance(payload, dict) or set(payload) != {"challenge_id"}:
        raise TeamRequestError("account continuation requires only challenge_id")
    return {"challenge_id": canonical_challenge_id(payload["challenge_id"])}
