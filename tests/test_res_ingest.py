"""Official RES CSV import: fixtures mirror the documented 2026 header layout."""
import importlib.util
import io
import pathlib
import unittest
import datetime as dt
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("res",ROOT/"scripts"/"res_ingest.py")
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
FIELDS=["ICO","OKRESLAU","DDATVZN","DDATZAN","ZPZAN","DDATPAKT","FORMA","ROSFORMA","KATPO",
        "NACE","NACE2025","ICZUJ","FIRMA","CISS2010","KODADM","TEXTADR","PSC","OBEC_TEXT",
        "COBCE_TEXT","ULICE_TEXT","TYPCDOM","CDOM","COR","DATPLAT","PRIZNAK"]
def record(ico,name,date,nace="43210",district="CZ0100",municipality="Praha",terminated="",flag="P"):
    d={k:"" for k in FIELDS}
    d.update({"ICO":ico,"OKRESLAU":district,"DDATVZN":date,"DDATZAN":terminated,
              "FIRMA":name,"NACE2025":nace,"OBEC_TEXT":municipality,"ULICE_TEXT":"Ulice",
              "CDOM":"11","PRIZNAK":flag,"DDATPAKT":"2026-10-01"})
    return d
class ResTests(unittest.TestCase):
    def test_registry_record_fresh(self):
        x=mod.interpret(record("12345678","Prague Construction s.r.o.","2026-09-10"),dt.date(2026,10,9))
        self.assertEqual(x["ico"],"12345678")
        self.assertEqual(x["discovery_pipeline"],"new")
        self.assertEqual(x["tier"],1)
        self.assertTrue(x["registered_office_only"])
        self.assertNotEqual(x["verification"],"qualified")
        self.assertIsNone(x["financial_evidence"])
    def test_older_business_still_eligible_for_redesign(self):
        x=mod.interpret(record("12345679","Old Roofers","2015-06-01"),dt.date(2026,10,9))
        self.assertEqual(x["discovery_pipeline"],"established")
        self.assertEqual(x["registered_at"],"2015-06-01")
    def test_suburban_and_terminated_rejected(self):
        self.assertIsNone(mod.interpret(record("12345670","Kladno Roofs","2026-01-01",district="CZ0203",municipality="Kladno"),dt.date(2026,10,9)))
        self.assertIsNone(mod.interpret(record("12345671","Closed Prague","2020-01-01",terminated="2024-01-01"),dt.date(2026,10,9)))
    def test_priznak_p_not_incorporation_date(self):
        x=mod.interpret(record("12345672","Old Company Renewal","2002-02-20",flag="P"),dt.date(2026,10,9))
        self.assertEqual(x["discovery_pipeline"],"established")
    def test_csv_real_csu_header_and_unicode(self):
        import csv
        rows=[record("12345673","Zednictví Žižkov","2026-09-12"),
              record("12345674","Technická služba","2010-01-01",nace="71120"),
              record("12345675","Outside","2026-01-01",district="CZ0202",municipality="Kladno")]
        buff=io.StringIO(newline="")
        writer=csv.DictWriter(buff,fieldnames=FIELDS,lineterminator="\r\n")
        writer.writeheader();writer.writerows(rows);buff.seek(0)
        leads,state,count=mod.ingest_csv(buff,{},dt.date(2026,10,9))
        self.assertEqual(len(leads),2)
        self.assertEqual(count["new"],1)
        self.assertEqual(count["established"],1)
        self.assertEqual(state["tracked"]["12345673"],mod.fingerprint(rows[0]))
    def test_incremental_update_vs_incorporation(self):
        base=record("12345676","Test Roofers","2019-01-01")
        original_fp=mod.fingerprint(base)
        base["DDATPAKT"]="2026-10-09"
        leads,state,counts=mod.candidates([base],{"tracked":{"12345676":original_fp}},dt.date(2026,10,9))
        self.assertEqual(leads[0]["snapshot_event"],"changed_record_not_new_company")
        self.assertEqual(leads[0]["discovery_pipeline"],"established")
        self.assertEqual(counts["changed_in_snapshot"],1)
    def test_invalid_schema_fails_without_overwriting(self):
        with self.assertRaises(ValueError):
            mod.ingest_csv(io.StringIO("ICO,FIRMA\n123,Test\n"),{})
if __name__=="__main__":unittest.main()
