import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("collector", ROOT / "scripts" / "refresh.py")
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)


class CollectorTests(unittest.TestCase):
    def sample(self, **tags):
        return {"type": "node", "id": 2312345, "tags": {"name": "Sample Prague Studio", "shop": "beauty", **tags}}

    def test_missing_website_is_never_claimed_absent(self):
        lead = collector.normalize_osm(self.sample())
        self.assertEqual(lead["website_status"], "not_listed")
        self.assertIn("Verify independently", lead["reason"])
        self.assertIsNone(lead["website_score"])

    def test_business_website_is_recognized(self):
        lead = collector.normalize_osm(self.sample(**{"contact:website": "https://example.cz"}))
        self.assertEqual(lead["website_status"], "listed")
        self.assertEqual(lead["website"], "https://example.cz")
        self.assertLess(lead["score"], 80)

    def test_address_is_prague_scoped(self):
        lead = collector.normalize_osm(self.sample(**{"addr:street": "Vinohradská", "addr:housenumber": "12", "addr:suburb": "Vinohrady"}))
        self.assertEqual(lead["district"], "Vinohrady")
        self.assertIn("Praha", lead["address"])

    def test_ares_dates_not_invented(self):
        lead = collector.normalize_osm(self.sample())
        self.assertIsNone(lead["registered_at"])
        self.assertFalse(lead["buying_signals"])

    def test_ico_format_and_duplicates(self):
        self.assertEqual(collector.normalize_ico("CZ 12345678"), "12345678")
        self.assertEqual(collector.normalize_ico("not available"), "")
        a = collector.normalize_osm(self.sample())
        b = dict(a, id="osm-way-12")
        self.assertEqual(collector.key_for(a), collector.key_for(b))

    def test_merging_preserves_first_discovery_and_verified_ares_date(self):
        a = collector.normalize_osm(self.sample())
        a["first_seen"] = "2026-01-01"
        a["registered_at"] = "2025-01-03"
        b = collector.normalize_osm(self.sample())
        b["first_seen"] = "2026-10-08"
        combined = collector.merge_existing(a, b)
        self.assertEqual(combined["first_seen"], "2026-01-01")
        self.assertEqual(combined["registered_at"], "2025-01-03")

    def test_query_is_prague_polygon_restricted(self):
        for name in collector.SEGMENTS:
            q = collector.osm_query(name)
            self.assertIn("area(3600435514)", q)
            self.assertIn("nwr(area.prague)", q)


if __name__ == "__main__":
    unittest.main()
