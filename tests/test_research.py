"""Offline unit tests for the evidence-based research pipeline."""
import importlib.util
import pathlib
import tempfile
import unittest
from unittest.mock import patch

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("fieldnotes_research",ROOT/"scripts"/"research.py")
research=importlib.util.module_from_spec(spec)
spec.loader.exec_module(research)

class ResearchTests(unittest.TestCase):
    def example(self, **overrides):
        record={"id":"test-1","name":"Example Prague Studio","industry":"Beauty & wellness",
                "ico":"12345678","address":"Vinohradská 15, Praha 2, Praha",
                "district":"Praha 2","website":"","email":"office@example.com",
                "phone":"+420 600 123 456","score":55,
                "source_urls":["https://www.openstreetmap.org/node/22"]}
        return {**record,**overrides}

    def test_public_urls_not_internal(self):
        for u in ("http://127.0.0.1:80/x","https://10.1.2.3/x","https://localhost/",
                  "ftp://example.org/x","https://169.254.169.254/latest"):
            self.assertFalse(research.valid_business_url(u),u)
        self.assertTrue(research.valid_business_url("https://example.cz/about"))

    def test_directory_is_not_company_website(self):
        self.assertTrue(research.is_directory("https://www.firmy.cz/detail/123"))
        self.assertTrue(research.is_directory("https://instagram.com/abc"))
        self.assertFalse(research.is_directory("https://example.cz/"))
        for website in ("https://www.ladypraha.cz/katalog/test", "http://www.place123.net/entry",
                        "https://local.infobel.cz/company", "https://rejstriky.finance.cz/details",
                        "https://rejstrik-firem.kurzy.cz/firm", "https://www.finmag.cz/obchodni-rejstrik"):
            self.assertTrue(research.is_directory(website), website)

    def test_redirected_directory_never_becomes_verified_website(self):
        example=self.example()
        search={"status":"searched","queries":["query-one","query-two"],"candidates":[{"url":"https://example.cz/business"}],"errors":[]}
        with patch.object(research,"search_results",return_value=search), \
             patch.object(research,"retrieve",return_value=({"url":"https://www.firmy.cz/detail/123","html":"Business IČO 12345678","status":200},None)):
            found=research.discover_website(example)
        self.assertNotEqual(found["state"],"VERIFIED_WEBSITE")
        self.assertEqual(found["website"],"")

    def test_identity_requires_business_name_and_street_or_exact_ico(self):
        lead=self.example()
        self.assertTrue(research.identity_confirmed(lead,["Matching IČO on website"]))
        self.assertTrue(research.identity_confirmed(lead,["Matching business name on website","Matching Prague street address on website"]))
        self.assertFalse(research.identity_confirmed(lead,["Matching business name on website","Prague mentioned on website"]))
        self.assertFalse(research.identity_confirmed(lead,["Matching Prague street address on website"]))

    def test_site_search_timeout_never_proves_absence(self):
        lead=self.example(website="")
        with patch.object(research,"search_results",return_value={"status":"search_unavailable","queries":[],"candidates":[],"errors":["Timeout"]}):
            found=research.discover_website(lead)
        self.assertEqual(found["state"],"SEARCH_UNAVAILABLE")
        self.assertFalse(found["no_website_proven"])
        self.assertEqual(found["website"],"")

    def test_doubtful_web_results_cannot_be_marked_missing(self):
        x=self.example()
        with patch.object(research,"search_results",return_value={"status":"searched","queries":["a","b"],"candidates":[{"url":"https://example.org/"}],"errors":[]}):
            with patch.object(research,"retrieve",return_value=({"url":"https://example.org/","html":"<html><body>Unrelated business</body></html>"},None)):
                value=research.discover_website(x)
        self.assertEqual(value["state"],"AMBIGUOUS")
        self.assertFalse(value["no_website_proven"])

    def test_registry_check_precedes_search_for_unverified_company(self):
        script=pathlib.Path(ROOT/"scripts"/"research.py").read_text(encoding="utf8")
        body=script.split("def run():",1)[1]
        self.assertLess(body.index("reg=registry(lead)"),body.index("discovery=discover_website(lead)"))

    def test_registry_directors_parsed_only_current_statutory_members(self):
        vr={"zaznamy":[{"statutarniOrgany":[{"clenoveOrganu":[
            {"fyzickaOsoba":{"jmeno":"Jana","prijmeni":"Nováková"},
             "clenstvi":{"funkce":{"nazev":"jednatel"}}},
            {"fyzickaOsoba":{"jmeno":"Former","prijmeni":"Person"},
             "datumVymazu":"2024-02-01"}]}]}]}
        directors=research.directors_from_vr(vr,"https://ares.gov.cz/firm/123")
        self.assertEqual(len(directors),1)
        self.assertEqual(directors[0]["name"],"Jana Nováková")
        self.assertEqual(directors[0]["role"],"jednatel")
        self.assertNotIn("datumNarozeni",directors[0])

    def test_dossier_never_fabricates_problems(self):
        lead=self.example()
        discovery={"state":"search_unavailable"}
        audit={"state":"not_run","reason":"Website unverified","objective_issues":[]}
        reg={"state":"not_checked","decision_maker":None}
        result=research.dossier(lead,discovery,audit,reg,[])
        self.assertEqual(result["observed_issues"],[])
        self.assertIsNone(result["decision_maker"])
        self.assertEqual(result["confidence"],"preliminary")
        self.assertIn("NOT proof",result["facts"][1])

    def test_daily_research_balances_new_and_established_service_companies(self):
        leads=[
            self.example(id="new-a",name="New Prague Plumbers",registered_at="2026-09-01",
                         industry="Construction & property",ico="12345678",tier=1),
            self.example(id="old-a",name="Old Prague Roofing",registered_at="2005-09-01",
                         industry="Construction & property",ico="12345679",tier=1),
            self.example(id="new-b",name="New Prague Renovations",registered_at="2026-09-02",
                         industry="Construction & property",ico="12345670",tier=1),
            self.example(id="old-b",name="Old Prague Electrician",registered_at="2012-04-03",
                         industry="Construction & property",ico="12345671",tier=1),
        ]
        with patch.object(research,"TODAY","2026-10-09"), patch.object(research,"PER_DAY",4):
            queue=research.pick_queue(leads,{})
        self.assertEqual(len(queue),4)
        self.assertTrue(queue[0]["id"].startswith("new"))
        self.assertTrue(queue[1]["id"].startswith("old"))
        self.assertTrue(queue[2]["id"].startswith("new"))
        self.assertTrue(queue[3]["id"].startswith("old"))

    def test_recent_complete_research_is_cached(self):
        lead=self.example(registered_at="2026-08-10",industry="Construction & property",tier=1)
        old={lead["id"]:{"checked_at":"2026-10-08","engine_version":research.ENGINE_VERSION,
                        "discovery":{"state":"VERIFIED_WEBSITE"}}}
        with patch.object(research,"TODAY","2026-10-09"):
            self.assertEqual(research.pick_queue([lead],old),[])

    def test_search_query_uses_ico_location_and_company_service(self):
        queries=research.search_queries(self.example(name="Prague Plumbing s.r.o.",ico="12345678"))
        self.assertGreaterEqual(len(queries),3)
        self.assertTrue(any("12345678" in q for q in queries))
        self.assertTrue(any("Vinohradská" in q for q in queries))
        self.assertTrue(any("Praha" in q for q in queries))

    def test_preferred_daily_queue_no_major_franchise(self):
        batch=[
            self.example(id="a",name="Local Prague Salon",ico=""),
            self.example(id="b",name="McDonald's",ico=""),
        ]
        queue=research.pick_queue(batch,{})
        self.assertEqual([l["id"] for l in queue],["a"])

if __name__=="__main__":
    unittest.main()
