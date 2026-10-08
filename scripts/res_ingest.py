#!/usr/bin/env python3
"""Streaming official ČSÚ RES ingestion. Does not scrape company directories.
Run daily; downloads the full (~540MB) official RES CSV only when modified.
A RES headquarters address is NOT verified evidence of a trading premises.
"""
from __future__ import annotations
import argparse
import csv
import datetime as dt
import gzip
import hashlib
import io
import json
import os
import re
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/"data"/"res-candidates.json"
STATE=ROOT/"data"/"res-state.json"
URL="https://opendata.csu.gov.cz/soubory/od/od_org03/res_data.csv"
DOCUMENTATION="https://csu.gov.cz/registr-ekonomickych-subjektu-otevrena-data-dokumentace"
PRAGUE_DISTRICT="CZ0100"
TIER1=("41","42","43","68","71","81")
TIER2=("25","28","29","33","45","46","49","62","69","70","74")
TIER3=("47","55","56","90","93","95","96")
ALL=TIER1+TIER2+TIER3
TODAY=dt.datetime.now(ZoneInfo("Europe/Prague")).date()
MAX_NEW=220
MAX_ESTABLISHED=120
MAX_TRACKED=16000

def parse_date(s):
    try:return dt.date.fromisoformat(str(s or ""))
    except ValueError:return None

def norm_ico(s):
    ico=re.sub(r"\D","",str(s or ""))
    return ico.zfill(8) if 1<=len(ico)<=8 else ""

def prague(row):
    # Exact locality match: Praha-východ and Praha-západ are excluded.
    return str(row.get("OKRESLAU","")).upper().strip()==PRAGUE_DISTRICT or str(row.get("OBEC_TEXT","")).casefold().strip() in ("praha","hlavní město praha")

def activity(row):
    code=re.sub(r"[^0-9]","",str(row.get("NACE2025") or row.get("NACE") or ""))
    prefix=code[:2]
    if prefix in TIER1:return 1,code,("Construction & property" if prefix in ("41","42","43","68","71") else "Specialized B2B")
    if prefix in TIER2:return 2,code,("Automotive" if prefix in ("29","45") else "Professional services")
    if prefix in TIER3:return 3,code,("Food & hospitality" if prefix in ("55","56") else "Independent services")
    return 0,code,"Other"

def interpret(row,today=TODAY):
    ico=norm_ico(row.get("ICO"))
    if not re.fullmatch(r"\d{8}",ico) or not prague(row):return None
    registered=parse_date(row.get("DDATVZN"))
    terminated=parse_date(row.get("DDATZAN"))
    if terminated and terminated<=today:return None
    name=str(row.get("FIRMA") or "").strip()
    if len(name)<4:return None
    tier,nace,sector=activity(row)
    if not tier:return None
    road=" ".join(x for x in (str(row.get("ULICE_TEXT") or "").strip(),str(row.get("CDOM") or "").strip()) if x)
    locality=str(row.get("OBEC_TEXT") or "").strip()
    addr=", ".join(x for x in (road,locality,str(row.get("PSC") or "").strip()) if x)
    if not addr:addr=str(row.get("TEXTADR") or "Praha").strip()[:220]
    age=(today-registered).days if registered else None
    bucket="new" if age is not None and 0<=age<=730 else "established"
    return {"id":"res-"+ico,"ico":ico,"name":name[:180],"registered_at":registered.isoformat() if registered else None,
      "address":addr[:250],"district":"Prague · registered office (operation unverified)",
      "industry":sector,"nace2025":nace,"tier":tier,"source_type":"csu_res",
      "discovery_pipeline":bucket,"legal_form":str(row.get("ROSFORMA") or row.get("FORMA") or "")[:20],
      "employee_category":str(row.get("KATPO") or "")[:20],
      "registration_status":"not_terminated_in_RES_snapshot",
      "last_registry_change":str(row.get("DDATPAKT") or "")[:20],
      "res_record_flag":str(row.get("PRIZNAK") or "")[:5],
      "registered_office_only":True,
      "verification":"candidate","website":"","website_status":"unknown","email":"","phone":"","instagram":"",
      "opened_at":None,"website_score":None,"contact_verified":False,"financial_evidence":None,
      "financial_capacity_status":"not_verified",
      "source_urls":[DOCUMENTATION],
      "source_registry_urls":[DOCUMENTATION],"source_snapshot":URL,
      "first_seen":today.isoformat(),"last_seen":today.isoformat(),
      "reason":"Official ČSÚ registration candidate. Verify with ARES, operating location, contact and website independently.",
      "offer":"B2B website with project references and enquiry workflow" if tier<=2 else "Professional service website",
      "buying_signals":[],"demo_potential":"Unassessed",
      "deal_min_czk":30000 if tier==1 else 20000,"deal_max_czk":100000 if tier==1 else 65000}

def fingerprint(row):
    keys=("ICO","DDATVZN","DDATZAN","DDATPAKT","FIRMA","NACE2025","KATPO","OKRESLAU","OBEC_TEXT","ULICE_TEXT")
    value="\x1f".join(str(row.get(k) or "") for k in keys)
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]

def candidates(reader,previous=None,today=TODAY):
    prev=(previous or {}).get("tracked",{})
    counts={"rows":0,"prague_relevant":0,"new":0,"established":0,"previously_tracked":len(prev),
            "first_seen_in_snapshot":0,"changed_in_snapshot":0}
    new, est = [], []
    for row in reader:
        counts["rows"]+=1
        lead=interpret(row,today)
        if not lead:continue
        counts["prague_relevant"]+=1
        ico=lead["ico"]
        fp=fingerprint(row)
        if ico in prev and prev[ico]!=fp:
            lead["snapshot_event"]="changed_record_not_new_company"
            counts["changed_in_snapshot"]+=1
        elif ico not in prev:
            lead["snapshot_event"]="first_seen_in_filtered_snapshot"
            if prev:counts["first_seen_in_snapshot"]+=1
        else:lead["snapshot_event"]="unchanged"
        lead["first_seen"]=(previous or {}).get("first_seen",{}).get(ico,today.isoformat())
        # Predictable global cap; prefer newer registrants and verified employment metadata.
        score=(1 if lead["employee_category"] else 0)
        if lead["discovery_pipeline"]=="new":
            new.append(((lead["registered_at"] or ""),-lead["tier"],score,ico,lead,fp))
            counts["new"]+=1
        else:
            # Stable deterministic sample across the entire dataset (not first N CSV rows).
            key=int(hashlib.sha256(ico.encode()).hexdigest()[:10],16)
            est.append((lead["tier"],key,ico,lead,fp))
            counts["established"]+=1
    # Stable two-cohort sample with full snapshot fingerprint of each published ICO.
    # Only the selected sample is indexed; no false full-universe change claims.
    selected_new=sorted(new,reverse=True)[:MAX_NEW]
    selected_est=sorted(est)[:MAX_ESTABLISHED]
    out=[]
    index={}
    first_seen={}
    for item in selected_new+selected_est:
        lead,fp=item[-2],item[-1]
        ico=lead["ico"]
        if ico in index:continue
        out.append(lead)
        index[ico]=fp
        first_seen[ico]=lead["first_seen"]
    counts["newly_seen_selected"]=sum(1 for l in out if l["snapshot_event"]=="first_seen_in_filtered_snapshot")
    counts["changed_selected"]=sum(1 for l in out if l["snapshot_event"]=="changed_record_not_new_company")

    counts["published_new"]=len(selected_new)
    counts["published_established"]=len(selected_est)
    counts["tracked_for_next_snapshot"]=len(index)
    return out,{"tracked":index,"first_seen":first_seen},counts

def ingest_csv(handle,previous=None,today=TODAY):
    rows=csv.DictReader(handle)
    required={"ICO","FIRMA","DDATVZN","DDATZAN","OKRESLAU","NACE","NACE2025","OBEC_TEXT","PRIZNAK"}
    missing=required-set(rows.fieldnames or [])
    if missing:raise ValueError("CSU RES schema missing expected fields: "+", ".join(sorted(missing)))
    return candidates(rows,previous,today)

def get_source():
    request=urllib.request.Request(URL,headers={"User-Agent":"Fieldnotes-Registry-Research/3.0",
        "Accept-Encoding":"gzip","Accept":"text/csv"})
    response=urllib.request.urlopen(request,timeout=120)
    stream=gzip.GzipFile(fileobj=response) if response.headers.get("Content-Encoding","").lower()=="gzip" else response
    return response,io.TextIOWrapper(stream,encoding="utf-8",newline="")

def run(path=None):
    oldstate=json.loads(STATE.read_text(encoding="utf8")) if STATE.exists() else {}
    olddoc=json.loads(OUTPUT.read_text(encoding="utf8")) if OUTPUT.exists() else {"leads":[]}
    if path is None and oldstate.get("last_modified"):
        # HEAD avoids repeatedly downloading a half-gigabyte unchanged CSV.
        try:
            req=urllib.request.Request(URL,method="HEAD",headers={"User-Agent":"Fieldnotes-Registry-Research/3.0"})
            with urllib.request.urlopen(req,timeout=22) as resp:
                modified=resp.headers.get("Last-Modified")
            if modified and modified==oldstate.get("last_modified") and olddoc.get("leads"):
                print("ČSÚ RES unchanged; existing snapshot retained",modified,flush=True)
                return {"changed":False}
        except Exception as exc:print("HEAD unavailable; fetch conservatively:",type(exc).__name__,flush=True)
    if path:
        with open(path,"r",encoding="utf-8",newline="") as source:
            fresh,state,counts=ingest_csv(source,oldstate)
        modified="fixture:"+Path(path).name
    else:
        response,stream=get_source()
        modified=response.headers.get("Last-Modified") or ""
        try:fresh,state,counts=ingest_csv(stream,oldstate)
        finally:stream.close();response.close()
    if not fresh:raise RuntimeError("RES returned zero relevant Prague records; retaining previous snapshot")
    merged={l["ico"]:l for l in olddoc.get("leads",[]) if l.get("ico")}
    for l in fresh:
        old=merged.get(l["ico"])
        if old:
            l["first_seen"]=old.get("first_seen",l["first_seen"])
            l["source_urls"]=list(dict.fromkeys((old.get("source_urls") or [])+l["source_urls"]))
        merged[l["ico"]]=l
    output=list(merged.values())
    output=sorted(output,key=lambda l:(l.get("discovery_pipeline")!="new",l.get("tier",3),l.get("registered_at") or ""),reverse=False)[:950]
    doc={"schema_version":1,"generated_at":dt.datetime.now(dt.timezone.utc).isoformat(),
         "source":"csu_res","source_url":URL,"last_modified":modified,"scope":"Prague registered office, priority CZ-NACE only",
         "coverage":"filtered candidate sample; NOT all Czech or Prague companies",
         "counts":counts,"leads":output}
    stat={"last_modified":modified,"snapshot_at":TODAY.isoformat(),"tracked":state["tracked"],
          "first_seen":state["first_seen"],"notes":"Index covers selected published Prague-sector subset only"}
    # Atomic writes: data preservation if download or parsing fails.
    for dst,data in ((OUTPUT,doc),(STATE,stat)):
        tmp=dst.with_suffix(dst.suffix+".tmp")
        tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
        tmp.replace(dst)
    print("RES snapshot ingested:",json.dumps(counts),flush=True)
    return {"changed":True,"counts":counts}

if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("--csv-path")
    args=parser.parse_args()
    run(args.csv_path)
