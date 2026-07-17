"""Local model-provider credentials owned exclusively by the Admin backend.

Only masked metadata is safe for HTTP responses. The cleartext resolver at the bottom is an
internal hand-off point for the local chat control plane; it must never be registered as a route,
placed in Capsule inference metadata, or sent through the Assistant Store iframe.
"""

from __future__ import annotations

import adminstore

PROVIDERS = {
    "openai": {"title": "OpenAI", "default_model": "gpt-5.5"},
    "anthropic": {"title": "Anthropic", "default_model": "claude-sonnet-5"},
}
MAX_API_KEY_BYTES = 8 * 1024
MIN_API_KEY_BYTES = 16


class ModelProviderError(ValueError):
    """A browser-supplied provider credential failed the closed contract."""


def canonical_provider(value: object) -> str:
    provider = str(value or "").strip().lower()
    if provider not in PROVIDERS:
        raise ModelProviderError("unsupported model provider")
    return provider


def canonical_api_key(value: object) -> str:
    if not isinstance(value, str) or value.strip() != value or not value.isascii():
        raise ModelProviderError("API key must be a trimmed ASCII string")
    encoded = value.encode("ascii")
    if not MIN_API_KEY_BYTES <= len(encoded) <= MAX_API_KEY_BYTES or any(not 33 <= byte <= 126 for byte in encoded):
        raise ModelProviderError("API key must contain 16 to 8192 printable characters")
    return value


def _records() -> dict:
    records = adminstore.model_credentials()
    unknown = set(records) - set(PROVIDERS)
    if unknown:
        raise RuntimeError("admin store has unsupported model credentials")
    return records


def _masked(secret: str) -> str:
    return f"••••{secret[-4:]}"


def status() -> dict[str, list[dict[str, object]]]:
    """Project configuration state without ever returning a provider key."""
    records = _records()
    providers = []
    for provider, metadata in PROVIDERS.items():
        record = records.get(provider)
        secret = record.get("api_key") if isinstance(record, dict) else None
        configured = isinstance(secret, str) and bool(secret)
        providers.append(
            {
                "id": provider,
                "title": metadata["title"],
                "default_model": metadata["default_model"],
                "configured": configured,
                "masked": _masked(secret) if configured else None,
            }
        )
    return {"providers": providers}


def configure(provider: object, api_key: object) -> dict[str, object]:
    selected = canonical_provider(provider)
    secret = canonical_api_key(api_key)
    adminstore.set_model_api_key(selected, secret)
    return next(item for item in status()["providers"] if item["id"] == selected)


def remove(provider: object) -> dict[str, object]:
    selected = canonical_provider(provider)
    adminstore.delete_model_api_key(selected)
    return next(item for item in status()["providers"] if item["id"] == selected)


def resolve_api_key(provider: object) -> str | None:
    """Resolve cleartext for a future backend-to-controller chat hand-off; never expose as HTTP."""
    selected = canonical_provider(provider)
    record = _records().get(selected)
    secret = record.get("api_key") if isinstance(record, dict) else None
    return canonical_api_key(secret) if isinstance(secret, str) else None
