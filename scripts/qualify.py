#!/usr/bin/env python3
"""Single evidence-aware 100 point scoring engine for dashboard AND top-three.
Never infer revenue, buyer budget or lack of website from an omitted directory link.
"""
from __future__ import annotations
import datetime as dt
import json
import re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
TODAY=dt.datetime.now(dt.timezone.utc).date()
CORE=ROOT/"data"/"leads.json"
MANUAL=ROOT/"data"/"manual-leads.json"
RESEARCH=ROOT/"data"/"research.json"
FINANCE=ROOT/"data"/"financial-evidence.json"
OUTPUT=ROOT/"data"/"qualification.json"

def date(s):
    try:return dt.date.fromisoformat(str(s or "")[:10])
    except ValueError:return None

def source_ok(x):
    return isinstance(x,str) and x.startswith("https://") and "." in x[8:]

def tier_for(l):
    t=l.get("tier")
    if t in (1,2,3):return t
    if l.get("industry") in ("Construction & property","Specialized B2B"):return 1
    if l.get("industry") in ("Automotive","Professional services","Creative services"):return 2
    return 3

def financial_score(lead,info):
    """Source-period constrained, conservative affordability evidence; estimates are separate."""
    valid=[]
    for item in info or []:
        if not isinstance(item,dict):continue
        period=date(item.get("period_end"))
        if not period or not 0 <= (TODAY-period).days <= 3*366:continue
        if not source_ok(item.get("source_url")):continue
        if item.get("evidence_kind") not in ("official_filed_accounts","public_contract_award"):
            continue
        valid.append(item)
    if not valid:
        return 0,{"status":"not_verified","facts":[],"confirmed_budget":None}
    facts=[]
    score=0
    for item in valid[:5]:
        kind=item["evidence_kind"]
        if kind=="official_filed_accounts":
            revenue=item.get("revenue_czk")
            profit=item.get("net_income_czk")
            if isinstance(revenue,(int,float)) and 0<=revenue<=1e12:
                score=max(score,18 if revenue>=10000000 else 12 if revenue>=3000000 else 6)
                facts.append({"kind":"revenue","value_czk":revenue,"period_end":item["period_end"],
                              "source_url":item["source_url"]})
            if isinstance(profit,(int,float)) and -1e12<=profit<=1e12:
                if profit>0:score=min(25,score+5)
                facts.append({"kind":"net_income","value_czk":profit,"period_end":item["period_end"],
                              "source_url":item["source_url"]})
        elif kind=="public_contract_award":
            amount=item.get("award_value_czk")
            if isinstance(amount,(int,float)) and amount>0 and amount<1e12:
                score=max(score,11)
                facts.append({"kind":"contract_award","value_czk":amount,
                              "period_end":item["period_end"],"source_url":item["source_url"]})
    # Never treat category-only employee data as verified annual revenue.
    return min(25,score),{"status":"public_financial_evidence" if facts else "not_verified",
                          "facts":facts,"confirmed_budget":None}

def result(lead,research=None,finance=None,today=TODAY):
    research=research or {}
    reg=research.get("registry") or {}
    discovery=research.get("discovery") or {}
    audit=research.get("audit") or {}
    objective=audit.get("objective_issues") or []
    website_state=discovery.get("state") or "SEARCH_UNAVAILABLE"
    if website_state=="verified_website":website_state="VERIFIED_WEBSITE"
    if website_state=="not_found_in_checked_sources":website_state="NO_VERIFIED_WEBSITE_FOUND"
    tier=tier_for(lead)
    verified_reg=reg.get("state")=="registry_found" and reg.get("ico")==str(lead.get("ico") or "")
    invalid=lead.get("do_not_contact") or reg.get("state") in ("inactive","mismatch") or lead.get("verification") in ("rejected","inactive_registry","closed")
    website=0
    if website_state=="VERIFIED_WEBSITE" and audit.get("state")=="observed" and objective:
        website=min(25,10+len(objective)*6)
    elif website_state=="THIRD_PARTY_PRESENCE_ONLY" and discovery.get("status")=="searched":
        website=10
    elif website_state=="NO_VERIFIED_WEBSITE_FOUND" and discovery.get("status")=="searched":
        website=9   # Not proof of absence, but follow-up opportunity.
    money,fin=financial_score(lead,finance)
    activity=0
    if verified_reg:activity+=8
    if not lead.get("registered_office_only") and lead.get("data_origin") in ("OpenStreetMap","Manual curation","Manual web research"):
        activity+=4
    if website_state=="VERIFIED_WEBSITE":activity+=3
    activity+=min(5,2*sum(1 for signal in (research.get("buying_signals") or [])
                          if signal.get("evidence_type") in ("verified_registry","dated_source_article")
                          and source_ok(signal.get("url"))))
    activity=min(20,activity)
    potential={1:12,2:9,3:6}.get(tier,0)
    if website>=16:potential+=3
    contact=0
    matches=research.get("contact_evidence") or []
    if matches:contact+=7
    elif lead.get("email") or lead.get("phone") or lead.get("instagram"):contact+=3
    if reg.get("decision_maker"):contact=min(10,contact+3)
    cms=({1:5,2:4,3:3}.get(tier,2) if website>0 else {1:3,2:2,3:1}.get(tier,1))
    scores={"website_opportunity":website,"financial_capacity":money,
            "business_activity":activity,"lead_generation_value":potential,
            "accessible_contact":contact,"cms_suitability":cms}
    total=sum(scores.values())
    reg_date=date(reg.get("registered_at")) or date(lead.get("registered_at"))
    premises_date=date(lead.get("premises_registered_at"))
    basis=reg_date if reg_date else premises_date
    age_days=(today-basis).days if basis else None
    age_group="new" if age_days is not None and 0<=age_days<=730 else "established"
    site_need=website>=15 or (website_state in ("NO_VERIFIED_WEBSITE_FOUND","THIRD_PARTY_PRESENCE_ONLY") and website>0)
    blockers=[]
    if not verified_reg:blockers.append("ARES identity and active legal status not verified")
    if lead.get("registered_office_only"):blockers.append("Registered HQ is not evidence of trading premises")
    if website_state=="SEARCH_UNAVAILABLE":blockers.append("Website search incomplete or unavailable")
    if website_state=="AMBIGUOUS":blockers.append("Company website identity ambiguous")
    if website_state=="NO_VERIFIED_WEBSITE_FOUND":blockers.append("No site found is not proof of absence; confirm with company")
    if not site_need:blockers.append("Concrete website development need not independently verified")
    if not fin["facts"]:blockers.append("Financial capacity not verified")
    if not matches:blockers.append("Public contact not independently cross-verified")
    if not reg.get("decision_maker"):blockers.append("Purchasing decision-maker not verified")
    if not research.get("buyer_interest_verified"):blockers.append("Buyer interest and budget not confirmed")
    if lead.get("verification")=="do_not_contact" or lead.get("do_not_contact"):
        status="do_not_contact"
    elif invalid:
        status="rejected"
    elif total>=80 and verified_reg and site_need and fin["facts"] and
         matches and reg.get("decision_maker") and research.get("buyer_interest_verified") is True:
        status="qualified_for_personalized_outreach_review"
    else:
        status="research_required"
    priority="high" if total>=80 else "further_qualification" if total>=60 else "low"
    return {"score":total,"score_breakdown":scores,"priority":priority,
            "qualification_status":status,"discovery_pipeline":age_group,
            "financial":fin,"website_classification":website_state,
            "registered_at":reg.get("registered_at") or lead.get("registered_at"),
            "source_type":lead.get("source_type") or lead.get("data_origin") or "unknown",
            "outstanding_checks":blockers,"tier":tier,
            "verified_ares":verified_reg}

def load(p,default):
    return json.loads(p.read_text(encoding="utf8")) if p.exists() else default

def run():
    base=load(CORE,{"leads":[]})
    manual=load(MANUAL,{"leads":[]})
    evidence=load(RESEARCH,{"reports":{}})
    finance=load(FINANCE,{"records":{}})
    merged={l["id"]:l for l in base["leads"] if l.get("id")}
    merged.update({l["id"]:l for l in manual.get("leads",[]) if l.get("id")})
    scored={l["id"]:result(l,evidence.get("reports",{}).get(l["id"]),
                            finance.get("records",{}).get(str(l.get("ico") or ""))) for l in merged.values()}
    doc={"schema_version":2,"generated_at":dt.datetime.now(dt.timezone.utc).isoformat(),
         "scoring_model":{"website_opportunity":25,"financial_capacity":25,"business_activity":20,
                          "lead_generation_value":15,"accessible_contact":10,"cms_suitability":5},
         "outreach_policy":"Research required until identity, website need, finance, buyer and contact verified.",
         "companies":scored}
    temp=OUTPUT.with_suffix(".json.tmp")
    temp.write_text(json.dumps(doc,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    temp.replace(OUTPUT)
    print("Unified qualification evaluated:",len(scored),"companies",flush=True)
    return doc

if __name__=="__main__":run()
