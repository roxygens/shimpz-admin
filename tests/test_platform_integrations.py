"""Contracts for the Space-wide integration catalog."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

import catalog
import keyset
import validate_live


class PlatformIntegrationTests(unittest.TestCase):
    def test_schema_and_catalog_have_no_global_telegram_surface(self) -> None:
        keys = {field["key"] for field in keyset.SCHEMA}

        self.assertNotIn("TELEGRAM_BOT_TOKEN", keys)
        self.assertNotIn("TELEGRAM_ALLOWED_USERS", keys)
        self.assertNotIn("telegram", catalog.CATALOG)
        self.assertNotIn("CHANNEL", catalog.CATEGORIES)
        self.assertNotIn("live_telegram", validate_live._LIVE)

    def test_every_managed_field_still_has_one_catalog_group(self) -> None:
        groups = {field["group"] for field in keyset.SCHEMA}

        self.assertEqual(groups, set(catalog.CATALOG))
        self.assertEqual(catalog.keys_for("openai"), ["SHIMPZ_OPENAI_MEDIA_API_KEY", "VOICE_TOOLS_OPENAI_KEY"])


if __name__ == "__main__":
    unittest.main()
