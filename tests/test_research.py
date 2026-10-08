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

    def test_preferred_daily_queue_no_major_franchise(self):
        batch=[
            self.example(id="a",name="Local Prague Salon",ico=""),
            self.example(id="b",name="McDonald's",ico=""),
        ]
        queue=research.pick_queue(batch,{})
        self.assertEqual([l["id"] for l in queue],["a"])

if __name__=="__main__":
    unittest.main()
