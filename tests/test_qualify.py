"""Evidence-graded qualification: no phantom finance, old firms not rejected."""
import importlib.util, pathlib, unittest, datetime as dt
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("qualification",ROOT/"scripts"/"qualify.py")
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class ScoreTests(unittest.TestCase):
 def lead(self,**x):
  return {"id":"res-12345678","ico":"12345678","name":"Czech Roof Contractors",
     "registered_at":"2004-03-01","industry":"Construction & property",
     "tier":1,"source_type":"csu_res","registered_office_only":True,"email":"",
     "phone":"",**x}
 def researched(self):
  return {"registry":{"state":"registry_found","ico":"12345678","registered_at":"2004-03-01"},
     "discovery":{"state":"VERIFIED_WEBSITE","status":"searched","website":"https://example.cz"},
     "audit":{"state":"observed","objective_issues":[{"issue":"mobile overflow","url":"https://example.cz"}]},
     "buying_signals":[],"contact_evidence":[]}
 def test_unverified_finance_never_earns_points(self):
  z=m.result(self.lead(),self.researched(),None,today=dt.date(2026,10,9))
  self.assertEqual(z["score_breakdown"]["financial_capacity"],0)
  self.assertEqual(z["financial"]["status"],"not_verified")
  self.assertEqual(z["qualification_status"],"research_required")
  self.assertEqual(sum(z["score_breakdown"].values()),z["score"])
 def test_older_company_allowed_for_redesign(self):
  z=m.result(self.lead(),self.researched(),today=dt.date(2026,10,9))
  self.assertEqual(z["discovery_pipeline"],"established")
  self.assertGreater(z["score_breakdown"]["website_opportunity"],0)
 def test_official_financial_evidence_needs_period_and_source(self):
  l=self.lead()
  evidence=[{"evidence_kind":"official_filed_accounts","period_end":"2026-03-31",
             "source_url":"https://or.justice.cz/legal-account-123","revenue_czk":12000000,"net_income_czk":350000}]
  z=m.result(l,self.researched(),evidence)
  self.assertGreaterEqual(z["score_breakdown"]["financial_capacity"],18)
  self.assertIsNone(z["financial"]["confirmed_budget"])
  bad=[dict(evidence[0],source_url="",period_end="2012-03-31")]
  zz=m.result(l,self.researched(),bad)
  self.assertEqual(zz["score_breakdown"]["financial_capacity"],0)
 def test_unknown_website_search_not_positive(self):
  x=self.researched();x["discovery"]={"state":"SEARCH_UNAVAILABLE"};x["audit"]={"state":"not_run"}
  z=m.result(self.lead(),x)
  self.assertEqual(z["score_breakdown"]["website_opportunity"],0)
 def test_no_verified_website_not_proof_of_absence(self):
  x=self.researched();x["discovery"]={"state":"NO_VERIFIED_WEBSITE_FOUND","status":"searched"};x["audit"]={}
  z=m.result(self.lead(),x)
  self.assertIn("No site found", " ".join(z["outstanding_checks"]))
 def test_inactive_company_rejected(self):
  x=self.researched();x["registry"]["state"]="inactive"
  z=m.result(self.lead(),x)
  self.assertEqual(z["qualification_status"],"rejected")
 def test_scoring_total_never_above_hundred(self):
  ev=[{"evidence_kind":"official_filed_accounts","period_end":"2026-03-31","source_url":"https://or.justice.cz/a","revenue_czk":30000000,"net_income_czk":1000000}]
  x=self.researched()
  x["audit"]["objective_issues"]=[{"issue":str(i)} for i in range(12)]
  x["buying_signals"]=[{"evidence_type":"dated_source_article","url":"https://example.cz/a"} for _ in range(9)]
  x["contact_evidence"]=[{"source":"https://example.cz"}]
  x["registry"]["decision_maker"]={"name":"Registered trader"}
  z=m.result(self.lead(),x,ev)
  self.assertLessEqual(z["score"],100)
  self.assertLessEqual(z["score_breakdown"]["website_opportunity"],25)
if __name__=="__main__":unittest.main()
