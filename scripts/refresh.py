#!/usr/bin/env python3
"""Prague prospect collector. Python standard library only; runs in GitHub Actions.

OSM listings are discovery candidates, not proof of an absent website or a new opening.
ARES only verifies incorporation dates when an OSM record includes an IČO.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "leads.json"
MANUAL = ROOT / "data" / "manual-leads.json"
OVERPASS_ENDPOINTS = (
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.nchc.org.tw/api/interpreter",
)
ARES_URL = "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/"
# OSM relation 435514: the administrative city of Prague.
PRAGUE_AREA = "3600435514"
SEGMENTS = {
    "beauty": ('shop', '^(hairdresser|beauty|massage|tattoo|cosmetics|perfumery)$'),
    "food": ('amenity', '^(cafe|restaurant|fast_food|bar|pub)$'),
    "services": ('office', '^(accountant|architect|estate_agent|lawyer|company|consulting|financial)$'),
    "trades": ('craft', '^(carpenter|electrician|plumber|painter|roofer|builder|photographer|hvac|interior_decorator|floorer)$'),
    "retail": ('shop', '^(car_repair|furniture|florist|bakery|interior_decoration|car|hardware|tyres)$'),
    "wellness": ('leisure', '^(fitness_centre|sports_centre)$'),
}
INDUSTRY = {
    "hairdresser": "Beauty & wellness", "beauty": "Beauty & wellness",
    "massage": "Beauty & wellness", "tattoo": "Beauty & wellness",
    "cosmetics": "Beauty & wellness", "perfumery": "Beauty & wellness",
    "cafe": "Food & hospitality", "restaurant": "Food & hospitality",
    "fast_food": "Food & hospitality", "bar": "Food & hospitality",
    "pub": "Food & hospitality", "bakery": "Food & hospitality",
    "accountant": "Professional services", "architect": "Construction & property",
    "estate_agent": "Construction & property", "lawyer": "Professional services",
    "consulting": "Professional services", "company": "Professional services",
    "financial": "Professional services",
    "carpenter": "Construction & property", "electrician": "Construction & property",
    "plumber": "Construction & property", "painter": "Construction & property",
    "roofer": "Construction & property", "builder": "Construction & property",
    "hvac": "Construction & property", "interior_decorator": "Construction & property",
    "floorer": "Construction & property", "photographer": "Creative services",
    "car_repair": "Automotive", "car": "Automotive",
    "tyres": "Automotive", "furniture": "Construction & property",
    "interior_decoration": "Construction & property", "florist": "Retail",
    "hardware": "Retail", "fitness_centre": "Beauty & wellness",
    "sports_centre": "Beauty & wellness",
}
DEALS = {
    "Construction & property": (30000, 85000),
    "Professional services": (25000, 60000),
    "Creative services": (20000, 50000),
    "Automotive": (25000, 55000),
    "Beauty & wellness": (17000, 45000),
    "Food & hospitality": (17000, 45000),
    "Retail": (15000, 35000),
}
PREMIUM = {"Construction & property", "Professional services", "Automotive"}
MAX_NEW_PER_RUN = 230
MAX_TOTAL = 1800
NOW = dt.datetime.now(dt.timezone.utc)
TODAY = NOW.date().isoformat()
ISO = NOW.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def read_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return default


def request_json(url, data=None, timeout=70):
    headers = {"User-Agent": "PragueFieldnotesLeadResearch/1.0 (source https://github.com/ThisismynameNOT/Websites-Leads)", "Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json; charset=utf-8"
        encoded = json.dumps(data, ensure_ascii=False).encode("utf-8")
    else:
        encoded = None
    req = urllib.request.Request(url, data=encoded, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.load(response)


def osm_query(segment):
    key, pattern = SEGMENTS[segment]
    # Restrict to Prague city administrative polygon, not outskirts.
    return ('[out:json][timeout:65];area(' + PRAGUE_AREA +
            ')->.prague;(nwr(area.prague)["' + key + '"~"' + pattern +
            '"]["name"];);out center 1250;')


def discover(segment):
    query = osm_query(segment)
    params = urllib.parse.urlencode({"data": query})
    errors = []
    for endpoint in OVERPASS_ENDPOINTS:
        try:
            payload = request_json(endpoint + "?" + params, timeout=88)
            if not isinstance(payload.get("elements"), list):
                raise ValueError("Missing OSM elements")
            print("OSM segment", segment, "->", len(payload["elements"]), "results via", endpoint, flush=True)
            return payload["elements"]
        except (urllib.error.URLError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
            errors.append(type(exc).__name__ + ": " + str(exc)[:110])
            print("OSM endpoint unavailable:", endpoint, errors[-1], file=sys.stderr, flush=True)
            time.sleep(1)
    raise RuntimeError("All Overpass endpoints failed for " + segment + ": " + "; ".join(errors))


def clean(value, max_chars=300):
    return str(value or "").strip()[:max_chars]


def osm_web(tags):
    return clean(tags.get("website") or tags.get("contact:website") or tags.get("url"))


def normalize_ico(value):
    digits = re.sub(r"\D", "", clean(value))
    return digits.zfill(8) if 1 <= len(digits) <= 8 else ""


def address_of(tags):
    street = clean(tags.get("addr:street"), 100)
    number = clean(tags.get("addr:housenumber"), 20)
    district = clean(tags.get("addr:suburb") or tags.get("addr:city_district") or tags.get("addr:district"), 100)
    postcode = clean(tags.get("addr:postcode"), 12)
    address = " ".join(part for part in [street, number] if part)
    return (", ".join(part for part in [address, district, postcode, "Praha"] if part),
            district if district else "Prague · district unverified")


def get_sector_tags(tags):
    for key in ["shop", "amenity", "office", "craft", "leisure"]:
        if tags.get(key) in INDUSTRY:
            return INDUSTRY[tags[key]]
    return "Other"


def score_lead(lead):
    """Transparent conservative 0–100 score; no automatic visual/mobile audit."""
    has_link = lead["website_status"] == "listed"
    website_need = 5 if has_link else 15
    age = None
    if lead.get("registered_at"):
        try:
            age = (NOW.date() - dt.date.fromisoformat(lead["registered_at"])).days
        except ValueError:
            pass
    freshness = 20 if age is not None and 0 <= age <= 180 else (
        17 if age is not None and 180 < age <= 365 else (
            12 if age is not None and 365 < age <= 730 else (5 if age is not None else 0)))
    industry = lead["industry"]
    commercial = 20 if industry in PREMIUM else (13 if industry not in {"Retail", "Other"} else 8)
    contact = 15 if (lead.get("email") and lead.get("phone")) else (
        10 if (lead.get("email") or lead.get("phone")) else (5 if lead.get("instagram") else 0))
    gap = 0 if has_link else 10
    score = website_need + freshness + commercial + contact + gap
    lead["score"] = min(100, score)
    lead["score_reason"] = (
        "Preliminary evidence-only score: website evidence "
        + str(website_need) + "/30, registered business age "
        + str(freshness) + "/20, sector value "
        + str(commercial) + "/20, public contactability "
        + str(contact) + "/15, listing gap "
        + str(gap) + "/15. No visual website audit performed."
    )
    return lead


def normalize_osm(element):
    tags = element.get("tags") or {}
    name = clean(tags.get("name"), 160)
    if len(name) < 3 or name.casefold() in {"yes", "no", "unknown", "shop", "restaurant"}:
        return None
    # For location validity rely on polygon-qualified Overpass query, not free-text geocoding.
    website = osm_web(tags)
    street, district = address_of(tags)
    kind = get_sector_tags(tags)
    item_type = clean(element.get("type"), 8)
    item_id = element.get("id")
    if item_type not in {"node", "way", "relation"} or not isinstance(item_id, int):
        return None
    contact = clean(tags.get("contact:email") or tags.get("email"), 160)
    phone = clean(tags.get("contact:phone") or tags.get("phone"), 80)
    instagram = clean(tags.get("contact:instagram") or tags.get("instagram"), 160)
    ico = normalize_ico(tags.get("ref:ico") or tags.get("ref:ICO") or tags.get("ref:vatin") or tags.get("company:ico"))
    if ico.startswith("00") and len(ico) != 8:
        ico = ""
    address = street
    source = "https://www.openstreetmap.org/" + item_type + "/" + str(item_id)
    deal_min, deal_max = DEALS.get(kind, (15000, 35000))
    missing = not website
    lead = {
        "id": "osm-" + item_type + "-" + str(item_id),
        "name": name, "industry": kind, "district": district,
        "address": address, "ico": ico,
        "website": website, "website_status": "not_listed" if missing else "listed",
        "email": contact, "phone": phone, "instagram": instagram,
        "opened_at": None, "registered_at": None, "website_score": None,
        "reason": ("No website URL is recorded on this OpenStreetMap listing. Verify independently before claiming that the company has no website."
                   if missing else "A website URL is recorded on this OpenStreetMap listing. No visual, UX, performance, or SEO audit has been performed."),
        "outreach_angle": ("Research whether the business already has a website, then propose a mobile-friendly service and enquiry experience."
                           if missing else "Review the existing site manually, identify a concrete conversion problem and only then pitch a redesign."),
        "buying_signals": [], "verification": "candidate",
        "demo_potential": "High" if kind in {"Construction & property", "Beauty & wellness", "Automotive", "Creative services", "Food & hospitality"} else "Medium",
        "offer": ("Premium lead-generation website" if kind in PREMIUM else
                  "Booking-ready business website" if kind in {"Beauty & wellness", "Food & hospitality"} else "Professional business website"),
        "deal_min_czk": deal_min, "deal_max_czk": deal_max,
        "source_urls": [source], "first_seen": TODAY, "last_seen": TODAY,
        "data_origin": "OpenStreetMap", "manual": False,
    }
    return score_lead(lead)


def enrich_ares(lead):
    ico = lead.get("ico")
    if not ico or len(ico) != 8:
        return lead
    try:
        record = request_json(ARES_URL + ico, timeout=18)
        if record.get("datumZaniku"):
            lead["verification"] = "inactive_registry"
            return lead
        start = record.get("datumVzniku")
        if start and re.fullmatch(r"\d{4}-\d{2}-\d{2}", start):
            lead["registered_at"] = start
            lead["source_urls"] = list(dict.fromkeys(lead["source_urls"] + ["https://ares.gov.cz/ekonomicke-subjekty?ico=" + ico]))
            lead["buying_signals"] = (["Registered within the last 24 months (ARES)"] if (
                0 <= (NOW.date() - dt.date.fromisoformat(start)).days <= 730) else [])
            lead["verification"] = "registry_checked"
        return score_lead(lead)
    except Exception as exc:
        print("ARES lookup failed for", ico, type(exc).__name__, file=sys.stderr)
        return lead


def key_for(lead):
    if lead.get("ico"):
        return "ico:" + str(lead["ico"])
    return "business:" + re.sub(r"\W+", "", str(lead.get("name", "")).casefold()) + "|" + re.sub(r"\W+", "", str(lead.get("address", "")).casefold())


def merge_existing(old, new):
    """Carry forward earliest discovery date and richer prior source fields."""
    merged = {**old, **new}
    merged["first_seen"] = old.get("first_seen") or new.get("first_seen")
    merged["source_urls"] = list(dict.fromkeys((old.get("source_urls") or []) + (new.get("source_urls") or [])))
    if not new.get("registered_at") and old.get("registered_at"):
        merged["registered_at"] = old["registered_at"]
        merged["verification"] = old.get("verification", merged.get("verification"))
    for field in ["email", "phone", "website", "instagram", "ico"]:
        if not merged.get(field) and old.get(field):
            merged[field] = old[field]
    if merged.get("website"):
        merged["website_status"] = "listed"
    return score_lead(merged) if not merged.get("manual") else merged


def run():
    old_data = read_json(OUTPUT, {"leads": []})
    old_leads = old_data.get("leads", [])
    manual_data = read_json(MANUAL, {"leads": []})
    if not isinstance(old_leads, list) or not isinstance(manual_data.get("leads"), list):
        raise ValueError("Invalid lead schema")
    by_id = {l["id"]: l for l in old_leads if isinstance(l, dict) and l.get("id")}
    # Rotate across all six categories: one category per four-hour window.
    window = NOW.hour // 4
    segment = list(SEGMENTS)[window % len(SEGMENTS)]
    print("Collector window:", NOW.isoformat(), "segment:", segment, "previous:", len(by_id), flush=True)
    elements = discover(segment)
    incoming = []
    for element in elements:
        item = normalize_osm(element)
        if item and item.get("verification") != "rejected":
            incoming.append(item)
    # Favor contactable candidates and listings without a website tag.
    incoming.sort(key=lambda l: (bool(l["email"] or l["phone"]), l["website_status"] == "not_listed", l["score"]), reverse=True)
    known_keys = {key_for(l) for l in by_id.values()}
    added = 0
    registry_checks = 0
    for lead in incoming:
        if lead["id"] in by_id:
            by_id[lead["id"]] = merge_existing(by_id[lead["id"]], lead)
        elif added < MAX_NEW_PER_RUN and key_for(lead) not in known_keys:
            if lead.get("ico") and registry_checks < 25:
                lead = enrich_ares(lead)
                registry_checks += 1
            if lead.get("verification") == "inactive_registry":
                continue
            by_id[lead["id"]] = lead
            known_keys.add(key_for(lead))
            added += 1
    # Manually-curated records always win and are never silently removed.
    for item in manual_data["leads"]:
        if not isinstance(item, dict) or not item.get("id") or not item.get("name"):
            print("Skipping invalid manual lead", file=sys.stderr)
            continue
        item = {**item, "manual": True, "data_origin": "Manual curation"}
        if item["id"] in by_id:
            item = {**by_id[item["id"]], **item}
        by_id[item["id"]] = item
    deduped = {}
    for lead in sorted(by_id.values(), key=lambda l: (bool(l.get("manual")), bool(l.get("ico")), int(l.get("score", 0))), reverse=True):
        k = key_for(lead)
        if k not in deduped:
            deduped[k] = lead
    leads = list(deduped.values())
    leads.sort(key=lambda l: (bool(l.get("manual")), int(l.get("score", 0)), l.get("first_seen", "")), reverse=True)
    leads = leads[:MAX_TOTAL]
    result = {
        "schema_version": 1, "generated_at": ISO,
        "collector": {
            "name": "OSM + optional ARES lookup", "segment": segment,
            "discovered_this_run": added, "listings_examined": len(elements),
            "notes": "No-website tag denotes a missing directory URL, not independently verified absence of a website. Scores are preliminary."
        },
        "leads": leads
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Success: leads", len(leads), "added", added, "ARES checks", registry_checks, "output", OUTPUT, flush=True)


if __name__ == "__main__":
    try:
        run()
    except Exception as error:
        # Preserve last good snapshot: file is only written on success.
        print("REFRESH FAILED; retained last snapshot:", str(error), file=sys.stderr, flush=True)
        raise
