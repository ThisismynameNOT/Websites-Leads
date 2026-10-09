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

    def test_daily_sector_rotation_covers_all_six_categories(self):
        import datetime as dt
        first = dt.date(2026, 10, 9)
        choices = [collector.segment_for_day(first + dt.timedelta(days=day)) for day in range(6)]
        self.assertEqual(set(choices), set(collector.SEGMENTS))
        self.assertEqual(collector.segment_for_day(first), collector.segment_for_day(first))

    def test_kurzy_recent_company_added_only_as_unverified_research_candidate(self):
        row={"ico":"29855209","name":"Poctivé rekonstrukce s.r.o.",
             "address":"Sídlištní 245/18A, Lysolaje, Praha",
             "registered_at":"2026-08-04","source_url":"https://regiony.kurzy.cz/praha/praha-lysolaje-mestska-cast/",
             "corroboration_url":"https://www.podnikatel.cz/rejstrik/poctive-rekonstrukce-s-r-o-29855209/",
             "industry":"Construction & property","tier":1}
        leads={};keys={}
        count=collector.import_kurzy_watchlist(leads,keys,[row],today="2026-10-09")
        self.assertEqual(count,1)
        self.assertEqual(keys["29855209"],"kurzy-29855209")
        lead=leads["kurzy-29855209"]
        self.assertEqual(lead["website_status"],"unknown")
        self.assertTrue(lead["registered_office_only"])
        self.assertEqual(lead["verification"],"candidate")
        self.assertFalse(lead["manual"])
        self.assertEqual(lead["score"],0)

    def test_kurzy_cross_check_does_not_replace_official_identity_or_site(self):
        original={"id":"res-29855209","ico":"29855209","name":"Official registry name",
                  "source_type":"csu_res","registered_at":"2026-08-01",
                  "website":"https://correct-company.cz","source_urls":["https://csu.gov.cz/"]}
        lead={"ico":"29855209","name":"Poctivé rekonstrukce s.r.o.",
              "address":"Sídlištní 245/18A, Praha", "registered_at":"2026-08-04",
              "source_url":"https://regiony.kurzy.cz/praha/praha-lysolaje-mestska-cast/"}
        records={"res-29855209":original};index={"29855209":"res-29855209"}
        count=collector.import_kurzy_watchlist(records,index,[lead],today="2026-10-09")
        self.assertEqual(count,1)
        got=records["res-29855209"]
        self.assertEqual(len(records),1)
        self.assertEqual(got["registered_at"],"2026-08-01")
        self.assertEqual(got["name"],"Official registry name")
        self.assertEqual(got["website"],"https://correct-company.cz")
        self.assertIn("regiony.kurzy.cz",str(got["source_urls"]))

    def test_kurzy_rejects_outside_prague_old_future_and_unattributed_records(self):
        good={"ico":"29855209","name":"Local Prague Construction","registered_at":"2026-08-04",
              "address":"Lysolaje, Praha",
              "source_url":"https://regiony.kurzy.cz/praha/praha-lysolaje-mestska-cast/"}
        rejects=[{**good,"ico":"29855210","address":"Brno"},
                 {**good,"ico":"29855211","registered_at":"2020-01-01"},
                 {**good,"ico":"29855212","registered_at":"2027-01-01"},
                 {**good,"ico":"29855213","source_url":"https://bad-example.cz/firms"},
                 {**good,"ico":"foo"}]
        leads={};index={}
        self.assertEqual(collector.import_kurzy_watchlist(leads,index,rejects,today="2026-10-09"),0)
        self.assertEqual(leads,{})

    def test_query_is_prague_polygon_restricted(self):
        for name in collector.SEGMENTS:
            q = collector.osm_query(name)
            self.assertIn("area(3600435514)", q)
            self.assertIn("nwr(area.prague)", q)


if __name__ == "__main__":
    unittest.main()
