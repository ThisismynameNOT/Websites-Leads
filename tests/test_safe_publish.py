"""No Git network required. Tests semantic merge used after non-fast-forward attempts."""
import importlib.util,pathlib,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("safe",ROOT/"scripts"/"safe_publish.py")
s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
class SafeTests(unittest.TestCase):
 def test_two_updated_records_preserve_best_and_sources(self):
  a={"id":"osm-1","name":"Prague Roofing","ico":"12345678","last_seen":"2026-10-08",
     "email":"info@roof.cz","first_seen":"2026-09-01","source_urls":["https://openstreetmap.org/1"],
     "verification":"registry_checked","manual":True}
  b={"id":"osm-1","name":"Prague Roofing","ico":"12345678","last_seen":"2026-10-09",
     "registered_at":"2025-12-01","source_urls":["https://ares.gov.cz/1"]}
  merged=s.latest(a,b)
  self.assertEqual(merged["email"],"info@roof.cz")
  self.assertEqual(merged["registered_at"],"2025-12-01")
  self.assertEqual(merged["first_seen"],"2026-09-01")
  self.assertEqual(len(merged["source_urls"]),2)
  self.assertTrue(merged["manual"])
 def test_remote_and_generated_leads_not_lost(self):
  old={"leads":[{"id":"one","name":"Old Prague","first_seen":"2026-06-01"}]}
  new={"leads":[{"id":"two","name":"New Prague","first_seen":"2026-10-09"}]}
  out=s.merge_doc("data/leads.json",old,new)
  self.assertEqual({x["id"] for x in out["leads"]},{"one","two"})
 def test_later_research_engine_wins_on_same_day(self):
  old={"reports":{"x":{"lead_id":"x","checked_at":"2026-10-09","engine_version":2,"name":"Old"}}}
  new={"reports":{"x":{"lead_id":"x","checked_at":"2026-10-09","engine_version":4,"name":"New"}}}
  got=s.merge_doc("data/research.json",old,new)
  self.assertEqual(got["reports"]["x"]["engine_version"],4)
 def test_no_force_push_or_rebase_in_implementation(self):
  text=(ROOT/"scripts"/"safe_publish.py").read_text(encoding="utf8")
  self.assertNotIn("git pull --rebase",text)
  self.assertNotIn('"--force"',text)
  self.assertIn('git("fetch","origin","main")',text)
if __name__=="__main__":unittest.main()
