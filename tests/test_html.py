"""Check that the standalone page preserves the tested guide and its navigation."""
from html.parser import HTMLParser
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]


class GuideHTML(HTMLParser):
    def __init__(self, content):
        super().__init__(convert_charrefs=True)
        self.elements = []
        self.snippets = {}
        self.active_snippet = None
        self.feed(content)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.elements.append((tag, attrs))
        if "data-source-block" in attrs:
            self.active_snippet = (tag, int(attrs["data-source-block"]))
            self.snippets[self.active_snippet[1]] = ""

    def handle_endtag(self, tag):
        if self.active_snippet and self.active_snippet[0] == tag:
            self.active_snippet = None

    def handle_data(self, data):
        if self.active_snippet:
            self.snippets[self.active_snippet[1]] += data


class HTMLGuideTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.page = GuideHTML((ROOT / "index.html").read_text())

    def test_all_documented_snippets_are_preserved(self):
        markdown = (ROOT / "docs/chezmoi-for-friends.ko.md").read_text()
        blocks = re.findall(r"```\w+\n(.*?)```", markdown, re.S)
        self.assertEqual(set(self.page.snippets), set(range(len(blocks))))
        for index, block in enumerate(blocks):
            with self.subTest(snippet=index):
                self.assertEqual(self.page.snippets[index].rstrip("\n"), block.rstrip("\n"))

    def test_navigation_and_accessible_relationships_resolve(self):
        ids = [attrs["id"] for _, attrs in self.page.elements if "id" in attrs]
        self.assertEqual(len(ids), len(set(ids)), "IDs must be unique")
        for tag, attrs in self.page.elements:
            with self.subTest(tag=tag, attrs=attrs):
                for attribute in ("aria-controls", "aria-labelledby", "aria-describedby", "for"):
                    for target in attrs.get(attribute, "").split():
                        self.assertIn(target, ids)
                href = attrs.get("href", "")
                if href.startswith("#"):
                    self.assertIn(href[1:], ids)
                elif href and not href.startswith("https://"):
                    self.assertTrue((ROOT / href).is_file(), href)

    def test_page_opens_without_external_assets(self):
        self.assertIn(("html", {"lang": "ko"}), self.page.elements)
        self.assertEqual(sum(tag == "h1" for tag, _ in self.page.elements), 1)
        for tag, attrs in self.page.elements:
            if tag in ("script", "img", "iframe", "link"):
                self.assertNotIn("src", attrs)
                self.assertNotIn("href", attrs)

    def test_pages_skips_jekyll_to_preserve_chezmoi_templates(self):
        self.assertEqual((ROOT / ".nojekyll").read_bytes(), b"")
        self.assertTrue((ROOT / "index.html").is_file())


if __name__ == "__main__":
    unittest.main()
