"""Fast contracts for the local Admin-owned model credential boundary."""

from __future__ import annotations

import json
import stat
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

import adminstore
import modelproviders


class ModelProviderTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.previous_store = adminstore.STORE_PATH
        adminstore.STORE_PATH = Path(self.temporary.name) / "admin.json"

    def tearDown(self) -> None:
        adminstore.STORE_PATH = self.previous_store
        self.temporary.cleanup()

    def test_status_masks_key_and_internal_resolver_is_backend_only(self) -> None:
        secret = "sk-test-0123456789abcdef"
        configured = modelproviders.configure("OpenAI", secret)

        self.assertEqual(configured["masked"], "••••cdef")
        self.assertNotIn(secret, json.dumps(modelproviders.status()))
        self.assertEqual(modelproviders.resolve_api_key("openai"), secret)
        self.assertEqual(stat.S_IMODE(adminstore.STORE_PATH.stat().st_mode), 0o600)

    def test_status_exposes_the_closed_catalog_with_exact_base_prices(self) -> None:
        status = modelproviders.status()

        self.assertEqual(
            status,
            {
                "providers": [
                    {
                        "id": "openai",
                        "title": "OpenAI",
                        "default_model": "gpt-5.6-terra",
                        "models": [
                            {
                                "id": "gpt-5.6-sol",
                                "title": "GPT-5.6 Sol",
                                "input_usd_per_million_cents": 500,
                                "output_usd_per_million_cents": 3_000,
                            },
                            {
                                "id": "gpt-5.6-terra",
                                "title": "GPT-5.6 Terra",
                                "input_usd_per_million_cents": 250,
                                "output_usd_per_million_cents": 1_500,
                            },
                            {
                                "id": "gpt-5.6-luna",
                                "title": "GPT-5.6 Luna",
                                "input_usd_per_million_cents": 100,
                                "output_usd_per_million_cents": 600,
                            },
                            {
                                "id": "gpt-5.5",
                                "title": "GPT-5.5",
                                "input_usd_per_million_cents": 500,
                                "output_usd_per_million_cents": 3_000,
                            },
                        ],
                        "configured": False,
                        "masked": None,
                    },
                    {
                        "id": "anthropic",
                        "title": "Anthropic",
                        "default_model": "claude-sonnet-5",
                        "models": [
                            {
                                "id": "claude-fable-5",
                                "title": "Claude Fable 5",
                                "input_usd_per_million_cents": 1_000,
                                "output_usd_per_million_cents": 5_000,
                            },
                            {
                                "id": "claude-opus-4-8",
                                "title": "Claude Opus 4.8",
                                "input_usd_per_million_cents": 500,
                                "output_usd_per_million_cents": 2_500,
                            },
                            {
                                "id": "claude-sonnet-5",
                                "title": "Claude Sonnet 5",
                                "input_usd_per_million_cents": 300,
                                "output_usd_per_million_cents": 1_500,
                            },
                            {
                                "id": "claude-haiku-4-5-20251001",
                                "title": "Claude Haiku 4.5",
                                "input_usd_per_million_cents": 100,
                                "output_usd_per_million_cents": 500,
                            },
                        ],
                        "configured": False,
                        "masked": None,
                    },
                ]
            },
        )
        status["providers"][0]["models"][0]["id"] = "mutated"
        self.assertEqual(modelproviders.status()["providers"][0]["models"][0]["id"], "gpt-5.6-sol")

    def test_provider_removal_preserves_other_keys(self) -> None:
        modelproviders.configure("openai", "sk-openai-0123456789")
        modelproviders.configure("anthropic", "sk-ant-0123456789")

        removed = modelproviders.remove("openai")

        self.assertFalse(removed["configured"])
        self.assertIsNone(modelproviders.resolve_api_key("openai"))
        self.assertEqual(modelproviders.resolve_api_key("anthropic"), "sk-ant-0123456789")

    def test_invalid_provider_and_key_fail_closed(self) -> None:
        for provider, secret in (
            ("codex", "sk-test-0123456789"),
            ("claude-code", "sk-test-0123456789"),
            ("openai", " short "),
            ("anthropic", "line-one\nline-two-secret"),
        ):
            with self.subTest(provider=provider, secret=secret), self.assertRaises(modelproviders.ModelProviderError):
                modelproviders.configure(provider, secret)

    def test_model_must_belong_to_its_provider(self) -> None:
        for provider, model in (
            ("openai", "claude-sonnet-5"),
            ("anthropic", "gpt-5.6-terra"),
            ("openai", "gpt-5.7"),
        ):
            with self.subTest(provider=provider, model=model), self.assertRaises(modelproviders.ModelProviderError):
                modelproviders.canonical_model(provider, model)


if __name__ == "__main__":
    unittest.main()
