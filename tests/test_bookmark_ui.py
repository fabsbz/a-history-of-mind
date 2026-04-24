import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE_JS = ROOT / "site.js"


class BookmarkUiRegressionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.site_js = SITE_JS.read_text(encoding="utf-8")

    def test_card_bookmark_buttons_are_placed_below_titles(self):
        self.assertIn("save-entry-slot save-entry-slot--", self.site_js)
        self.assertIn("targetHeading.insertAdjacentElement('afterend', slot)", self.site_js)
        self.assertNotIn("targetHeading.append(' ', button)", self.site_js)

    def test_normalize_entry_href_preserves_content_directory(self):
        function_match = re.search(
            r"function normalizeEntryHref\(value\) \{(?P<body>.*?)\n\}",
            self.site_js,
            re.S,
        )
        self.assertIsNotNone(function_match)
        body = function_match.group("body")
        self.assertIn("CONTENT_ENTRY_DIRECTORIES", body)
        self.assertIn("const isAlreadySiteRelative", self.site_js)
        self.assertIn("if (isAlreadySiteRelative) return rawValue;", self.site_js)
        self.assertNotIn("return file || '';", body)

    def test_bare_legacy_bookmark_hrefs_migrate_to_philosopher_pages(self):
        self.assertIn("LEGACY_ROOT_ENTRY_HREFS", self.site_js)
        self.assertIn("return `philosophers/${rawValue}`;", self.site_js)

    def test_saved_panel_links_use_page_relative_hrefs(self):
        self.assertIn("formatEntryLinkHref(entry.href)", self.site_js)
        self.assertIn("function formatEntryLinkHref(href) {", self.site_js)
        self.assertIn("? `../${normalizedHref}` : normalizedHref", self.site_js)


if __name__ == "__main__":
    unittest.main()
