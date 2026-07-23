"""Immutable challenge documents shared by Admin WebSocket contract suites."""

from __future__ import annotations

import importlib

TURN_ID = "a" * 32
CHALLENGE_ID = "b" * 32


def requirements() -> list[dict[str, object]]:
    return [
        {
            "assistant_id": "weather-guide",
            "assistant_name": "Weather Guide",
            "power_ids": ["current-weather", "daily-forecast"],
            "secrets": [
                {
                    "id": "weather-api-token",
                    "name": "Weather API token",
                    "summary": "Authenticates requests to the configured weather provider.",
                }
            ],
        }
    ]


def challenge(status: int = 428) -> object:
    localchat_module = importlib.import_module("localchat")
    return localchat_module.PublicResponse(
        status,
        {
            "team_id": "team_1",
            "status": "secrets-required",
            "turn_id": TURN_ID,
            "challenge_id": CHALLENGE_ID,
            "requirements": requirements(),
        },
    )


def approval_requirements() -> list[dict[str, object]]:
    return [
        {
            "assistant_id": "social-publisher",
            "assistant_name": "Social Publisher",
            "power_id": "create-post",
            "title": "Publish post",
            "summary": "Publish this exact post on X.",
            "docs": "https://docs.example.com/publish",
            "approval": "once",
        },
    ]


def approval_challenge(status: int = 428) -> object:
    localchat_module = importlib.import_module("localchat")
    return localchat_module.PublicResponse(
        status,
        {
            "team_id": "team_1",
            "status": "approval-required",
            "turn_id": TURN_ID,
            "challenge_id": CHALLENGE_ID,
            "requirements": approval_requirements(),
        },
    )


def input_challenge(request_type: str, answer_options: list[str] | None = None, status: int = 428) -> object:
    localchat_module = importlib.import_module("localchat")
    return localchat_module.PublicResponse(
        status,
        {
            "team_id": "team_1",
            "status": "input-required",
            "turn_id": TURN_ID,
            "challenge_id": CHALLENGE_ID,
            "request": {
                "type": request_type,
                "title": "Choose",
                "summary": "Provide one value.",
                "docs": None,
                "options": answer_options or [],
            },
        },
    )


def account_requirements() -> list[dict[str, object]]:
    return [
        {
            "assistant_id": "social-publisher",
            "assistant_name": "Social Publisher",
            "account_id": "x-account",
            "provider": "x",
            "name": "X account",
            "summary": "Lets approved Powers access the connected X account.",
            "scopes": ["tweet.read", "tweet.write", "users.read", "offline.access"],
            "powers": [
                {"id": "profile-me", "name": "Read profile", "summary": "Read the connected X profile."},
                {"id": "create-post", "name": "Create post", "summary": "Publish a post on X."},
            ],
        }
    ]


def account_challenge(status: int = 428) -> object:
    localchat_module = importlib.import_module("localchat")
    return localchat_module.PublicResponse(
        status,
        {
            "team_id": "team_1",
            "status": "accounts-required",
            "turn_id": TURN_ID,
            "challenge_id": CHALLENGE_ID,
            "expires_in": 300,
            "requirements": account_requirements(),
        },
    )


def inventory() -> object:
    localchat_module = importlib.import_module("localchat")
    return localchat_module.PublicResponse(
        200,
        {
            "team_id": "team_1",
            "assistants": [
                {
                    "id": "weather-guide",
                    "name": "Weather Guide",
                    "secrets": [
                        {
                            "id": "weather-api-token",
                            "name": "Weather API token",
                            "summary": "Authenticates requests to the configured weather provider.",
                            "configured": True,
                            "mask": "sk…89",
                        }
                    ],
                }
            ],
        },
    )
