#!/usr/bin/env python3
"""Daily evidence-oriented researcher for Prague websites.
Discovery is best-effort: search-engine blocks and ambiguous matches remain UNKNOWN.
No search result can prove that no website exists. A browser audit proves observed
technical symptoms only, not subjective aesthetic quality or commercial intent.
"""
from __future__ import annotations
import datetime as dt
import ipaddress
import json
import os
import re
import socket
import sys
import tempfile
import time
import unicodedata
import urllib.parse
from pathlib import Path

try:
    import requests
except ImportError:
    requests = None

ROOT = Path(__file__).resolve().parents[1]
LEADS = ROOT / "data/leads.json"
MANUAL = ROOT / "data/manual-leads.json"
OUTPUT = ROOT / "data/research.json"
SCREENSHOTS = ROOT / "research-screenshots"
PER_DAY = min(18, max(1, int(os.environ.get("RESEARCH_DAILY_LIMIT", "12"))))
QUERY_WAIT = 1.1
TODAY = dt.datetime.now(dt.timezone.utc).date().isoformat()
USER_AGENT = "Mozilla/5.0 (compatible; FieldnotesResearch/2.0; +https://github.com/ThisismynameNOT/Websites-Leads)"
DIRECTORIES = {
    "firmy.cz", "mapy.cz", "google.com", "google.cz", "facebook.com", "instagram.com",
    "linkedin.com", "yelp.com", "tripadvisor.com", "tripadvisor.cz", "opencorporates.com",
    "podnikatel.cz", "ares.gov.cz", "justice.cz", "seznam.cz", "idatabaze.cz",
    "zivefirmy.cz", "restu.cz", "slevomat.cz", "booking.com", "wolt.com",
    "foodora.cz", "restaurantguru.com", "restaurace.cz", "mapquest.com",
    "wikipedia.org", "maps.apple.com", "foursquare.com", "zomato.com",
    "reservio.com", "bookio.com", "notino.cz", "treatwell.cz",
}
CHAIN_RE = re.compile(r"\b(mcdonald'?s|starbucks|kfc|burger king|subway|lidl|tesco|billa|albert|ikea|dhaba beas)\b", re.I)
SIGNALS = {"new_registration": "Registered in the previous 24 months (ARES)"}


def normalized(s):
    s = unicodedata.normalize("NFKD", str(s or "").casefold())
    return re.sub(r"[^a-z0-9]+", " ", "".join(c for c in s if not unicodedata.combining(c))).strip()


def firm_words(s):
    return [w for w in normalized(s).split() if w not in {
        "s", "r", "o", "as", "a", "the", "praha", "prague", "studio", "cafe",
        "kavarna", "salon", "beauty", "restaurant", "firma", "cz", "spol"
    }]


def valid_business_url(u):
    try:
        x = urllib.parse.urlsplit(str(u).strip())
        if x.scheme not in ("http", "https") or not x.hostname:
            return False
        host = x.hostname.lower().strip(".")
        if host == "localhost" or host.endswith((".local", ".internal", ".localhost")):
            return False
        try:
            ip = ipaddress.ip_address(host)
            return ip.is_global
        except ValueError:
            return "." in host and len(host) <= 250
    except (ValueError, TypeError):
        return False


def host_for(u):
    return (urllib.parse.urlsplit(u).hostname or "").lower().removeprefix("www.")


def is_directory(u):
    if not valid_business_url(u):
        return True
    h = host_for(u)
    return any(h == d or h.endswith("." + d) for d in DIRECTORIES)


def network_safe(u):
    """Reject non-public destinations before making HTTP requests.
    Do not follow redirects without checking their destination as well.
    """
    if not valid_business_url(u):
        return False
    host = urllib.parse.urlsplit(u).hostname
    try:
        values = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
        return bool(values) and all(ipaddress.ip_address(v[4][0]).is_global for v in values)
    except (socket.gaierror, ValueError, OSError):
        return False


def retrieve(u, *, timeout=11, max_bytes=650000):
    if requests is None:
        return None, "requests_unavailable"
    if not network_safe(u):
        return None, "unsafe_or_unresolved_url"
    try:
        current = u
        for _ in range(4):
            r = requests.get(current, timeout=timeout, headers={"User-Agent": USER_AGENT},
                             allow_redirects=False, stream=True)
            if r.status_code in (301, 302, 303, 307, 308):
                location = r.headers.get("Location", "")
                r.close()
                current = urllib.parse.urljoin(current, location)
                if not network_safe(current):
                    return None, "unsafe_redirect"
                continue
            if r.status_code != 200:
                r.close()
                return None, "HTTP_" + str(r.status_code)
            if not any(k in r.headers.get("Content-Type", "").lower() for k in ("html", "text/plain")):
                r.close()
                return None, "not_html"
            content = bytearray()
            for piece in r.iter_content(chunk_size=16384):
                content.extend(piece)
                if len(content) > max_bytes:
                    break
            enc = r.encoding or "utf-8"
            html = bytes(content[:max_bytes]).decode(enc, errors="replace")
            r.close()
            return {"url": current, "html": html, "status": 200}, None
        return None, "too_many_redirects"
    except requests.RequestException as e:
        return None, type(e).__name__


def identity_evidence(lead, html):
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html[:650000], "html.parser")
    for s in soup(["script", "style", "noscript"]):
        s.decompose()
    body = normalized(soup.get_text(" ", strip=True)[:160000])
    if not body:
        return []
    proof = []
    ico = re.sub(r"\D", "", str(lead.get("ico") or ""))
    if len(ico) == 8 and re.search(r"(?<!\\d)"+re.escape(ico)+r"(?!\\d)", soup.get_text(" ", strip=True)):
        proof.append("Matching IČO on website")
    full_name = normalized(lead.get("name"))
    if len(full_name) >= 7 and full_name in body:
        proof.append("Matching business name on website")
    else:
        words = firm_words(lead.get("name"))
        if len(words) >= 2 and all(len(w) >= 3 and w in body for w in words[:3]):
            proof.append("Matching distinctive business-name words on website")
    street = normalized(str(lead.get("address", "")).split(",")[0])
    street_name = re.sub(r"\b\d+\b", "", street).strip()
    if len(street_name) >= 5 and street_name in body:
        proof.append("Matching Prague street address on website")
    if "praha" in body or "prague" in body:
        proof.append("Prague mentioned on website")
    return proof


def identity_confirmed(lead, proof):
    if "Matching IČO on website" in proof:
        return True
    names = any(x.startswith("Matching business name") or x.startswith("Matching distinctive") for x in proof)
    address = any(x.startswith("Matching Prague street address") for x in proof)
    return names and address


def search_queries(lead):
    name = str(lead["name"]).replace('"', "").strip()
    address = str(lead.get("address") or "").split(",")[0]
    search = ['"' + name + '" Praha webové stránky', '"' + name + '" "' + address[:50] + '" website']
    return search if address and address.lower() not in ("praha", "prague") else search[:1]


def search_results(lead):
    """Uses unauthenticated metasearch; a failure is not a negative result.
    Prefer BRAVE_SEARCH_API_KEY for a supported, authenticated search service.
    """
    queries = search_queries(lead)
    results, errors = [], []
    key = os.getenv("BRAVE_SEARCH_API_KEY")
    for query in queries:
        try:
            if key:
                r = requests.get("https://api.search.brave.com/res/v1/web/search",
                                 params={"q": query, "count": 8, "country": "CZ"},
                                 headers={"X-Subscription-Token": key, "Accept": "application/json"},
                                 timeout=15)
                r.raise_for_status()
                items = [{"href": z.get("url"), "title": z.get("title"),
                          "body": z.get("description")} for z in r.json().get("web", {}).get("results", [])]
            else:
                from ddgs import DDGS
                with DDGS(timeout=15) as client:
                    items = list(client.text(query, max_results=8, region="cz-cs"))
            results.extend(items)
        except Exception as exc:
            errors.append(type(exc).__name__ + ": " + str(exc)[:100])
        time.sleep(QUERY_WAIT)
    deduped, seen = [], set()
    for item in results:
        u = item.get("href") or item.get("url") or ""
        if not valid_business_url(u) or u in seen:
            continue
        seen.add(u)
        deduped.append({"url": u, "title": str(item.get("title") or "")[:180],
                        "snippet": str(item.get("body") or "")[:320]})
    status = "searched" if results else ("search_unavailable" if errors else "no_results")
    return {"status": status, "queries": queries, "candidates": deduped[:14],
            "errors": errors[:3]}


def discover_website(lead):
    discovery = search_results(lead)
    sources = []
    # An already published business link must be verified independently too.
    claimed = lead.get("website", "")
    urls = ([claimed] if valid_business_url(claimed) else [])
    urls += [c["url"] for c in discovery["candidates"]]
    seen_hosts = set()
    for u in urls:
        if is_directory(u):
            continue
        host = host_for(u)
        if host in seen_hosts:
            continue
        seen_hosts.add(host)
        page, err = retrieve(u)
        if not page:
            sources.append({"url": u, "result": "unreachable", "reason": err})
            continue
        proof = identity_evidence(lead, page["html"])
        good = identity_confirmed(lead, proof)
        sources.append({"url": page["url"], "result": "identity_match" if good else "ambiguous",
                        "evidence": proof})
        if good:
            # A listed email/phone is cross-checked against the identity-matched site.
            body_text = page["html"].casefold()
            contact_checks = []
            email = str(lead.get("email") or "").strip().casefold()
            digits = re.sub(r"\D","",str(lead.get("phone") or ""))
            if email and email in body_text:
                contact_checks.append({"method":"email_matches_business_website",
                                       "value":email,"source":page["url"]})
            if digits and len(digits)>=9 and any(re.sub(r"\D","",a.get("href","")).endswith(digits[-9:]) for a in BeautifulSoup(page["html"],"html.parser").select("a[href^=tel]")):
                contact_checks.append({"method":"phone_matches_business_website",
                                       "value":str(lead.get("phone")),"source":page["url"]})
            discovery["contact_matches"] = contact_checks
            discovery["website"] = page["url"]
            discovery["state"] = "verified_website"
            discovery["identity"] = proof
            break
    if "state" not in discovery:
        discovery["state"] = "not_found_in_checked_sources" if discovery["status"] in ("searched", "no_results") else "search_unavailable"
        discovery["website"] = ""
    discovery["examined"] = sources[:9]
    discovery["no_website_proven"] = False
    return discovery


def directors_from_vr(record, source_url):
    """Extract CURRENT statutory members from official ARES VR fields only."""
    out = []
    for entry in record.get("zaznamy", []):
        if not isinstance(entry,dict): continue
        for org in entry.get("statutarniOrgany", []):
            if not isinstance(org,dict) or org.get("datumVymazu"): continue
            for member in org.get("clenoveOrganu", []):
                if not isinstance(member,dict) or member.get("datumVymazu"): continue
                person=member.get("fyzickaOsoba",{})
                if not isinstance(person,dict): continue
                given=str(person.get("jmeno") or "").strip()
                surname=str(person.get("prijmeni") or "").strip()
                if not given or not surname: continue
                role=str(((member.get("clenstvi") or {}).get("funkce") or {}).get("nazev") or member.get("nazevAngazma") or "Statutory member")
                out.append({"name":(given+" "+surname)[:110],"role":role[:110],
                            "source":source_url,"verified_scope":"Public statutory member; marketing purchasing authority unverified"})
    return list({x["name"]+x["role"]:x for x in out}.values())[:8]


def registry(lead):
    ico = re.sub(r"\D", "", str(lead.get("ico") or ""))
    if len(ico) != 8:
        return {"state": "not_checked", "reason": "No verified IČO in candidate data", "decision_maker": None}
    u = "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/" + ico
    source = "https://ares.gov.cz/ekonomicke-subjekty?ico=" + ico
    if not network_safe(u) or requests is None:
        return {"state": "unavailable", "reason": "Registry request unavailable", "decision_maker": None}
    try:
        response = requests.get(u, headers={"Accept": "application/json", "User-Agent": USER_AGENT}, timeout=14)
        response.raise_for_status()
        j = response.json()
        if str(j.get("ico") or "") != ico:
            return {"state": "mismatch", "reason": "IČO did not match official response", "decision_maker": None}
        state = "inactive" if j.get("datumZaniku") else "registry_found"
        legal_name = str(j.get("obchodniJmeno") or "")
        result = {"state": state, "ico": ico, "legal_name": legal_name[:160],
                  "registered_at": j.get("datumVzniku"), "source": source,
                  "decision_maker": None, "contact_verified": False}
        vr_url="https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty-vr/"+ico
        if network_safe(vr_url):
            try:
                vr_response=requests.get(vr_url,headers={"Accept":"application/json","User-Agent":USER_AGENT},timeout=14)
                vr_response.raise_for_status()
                vr=vr_response.json()
                if isinstance(vr,dict) and str(vr.get("icoId") or "")==ico:
                    members=directors_from_vr(vr,source)
                    result["statutory_members"]=members
                    if members:result["decision_maker"]=members[0]
                else:result["statutory_members"]=[]
            except (requests.RequestException,ValueError,TypeError) as exc:
                result["statutory_members"]=[]
                result["director_lookup_status"]=type(exc).__name__
        if result.get("decision_maker") is None and str(j.get("pravniForma") or "") in ("101","102","103"):
            if len(normalized(legal_name).split())>=2:
                result["decision_maker"]={"name":legal_name[:110],"role":"Registered sole trader",
                    "source":source,"verified_scope":"Registered operator; purchasing authority unverified"}
        return result
    except Exception as e:
        return {"state": "unavailable", "reason": type(e).__name__, "decision_maker": None}


def browser_audit(website, ident):
    """Observed DOM and responsive geometry, screenshots for HUMAN visual review.
    Not a professional visual-design score or a guarantee of accessibility.
    """
    if not network_safe(website):
        return {"state": "not_run", "reason": "Site address failed public-network safety validation"}
    try:
        from playwright.sync_api import sync_playwright
        SCREENSHOTS.mkdir(exist_ok=True)
        findings = {}
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, args=["--no-sandbox"])
            try:
                for name, width, height in [("desktop", 1365, 768), ("mobile", 390, 844)]:
                    context = browser.new_context(viewport={"width": width, "height": height},
                                                  device_scale_factor=1,
                                                  user_agent=USER_AGENT)
                    try:
                        page = context.new_page()
                        page.set_default_timeout(14000)
                        response = page.goto(website, wait_until="domcontentloaded", timeout=19000)
                        page.wait_for_timeout(500)
                        metrics = page.evaluate("""() => {
                          const body = document.body, root=document.documentElement;
                          const texts = [...document.querySelectorAll('p, h1, h2, h3, a, button, li')].slice(0,250);
                          const visible = texts.filter(e=>{let r=e.getBoundingClientRect(); return r.width>0 && r.height>0});
                          const small = visible.filter(e=>parseFloat(getComputedStyle(e).fontSize)<12).length;
                          const broken = [...document.images].filter(e=>e.complete && e.naturalWidth===0).length;
                          const links = [...document.querySelectorAll('a[href]')].map(e=>e.href);
                          return {
                            title:document.title.slice(0,180),
                            description:document.querySelector('meta[name="description"]')?.content?.slice(0,250)||"",
                            viewport_meta:!!document.querySelector('meta[name="viewport"]'),
                            h1_count:document.querySelectorAll('h1').length,
                            horizontal_overflow_px:Math.max(0, root.scrollWidth-width),
                            visible_text_elements:visible.length,
                            small_text_elements:small,
                            broken_images:broken,
                            images_missing_alt:[...document.images].filter(e=>!e.hasAttribute('alt')).length,
                            images_count:document.images.length,
                            contact_action:links.some(h=>h.startsWith('mailto:')||h.startsWith('tel:')),
                            form_count:document.querySelectorAll('form').length,
                            booking_links:links.filter(h=>/reservio|bookio|calendly|booking|rezerv|objednat/i.test(h)).length
                          };
                        }""".replace("root.scrollWidth-width", "root.scrollWidth-window.innerWidth"))
                        metrics["http_status"] = response.status if response else None
                        findings[name] = metrics
                        # Screenshot is for review and never used alone to hallucinate a design diagnosis.
                        name_safe = re.sub(r"[^a-zA-Z0-9_-]", "", ident)[:80]
                        path = SCREENSHOTS / (name_safe + "-" + name + ".webp")
                        page.screenshot(path=str(path), type="webp", quality=55,
                                        full_page=False, animations="disabled", timeout=10000)
                    finally:
                        context.close()
            finally:
                browser.close()
        observed = []
        if findings["mobile"]["horizontal_overflow_px"] >= 15:
            observed.append({"issue": "Measured mobile horizontal overflow", "detail": str(findings["mobile"]["horizontal_overflow_px"]) + " CSS pixels",
                             "method": "Playwright viewport 390px", "url": website})
        if not findings["mobile"]["viewport_meta"]:
            observed.append({"issue": "Missing viewport meta tag", "detail": "No name=viewport in DOM", "method": "Playwright DOM", "url": website})
        if findings["mobile"]["broken_images"] > 0:
            observed.append({"issue": "Broken image elements", "detail": str(findings["mobile"]["broken_images"]) + " observed on mobile viewport", "method": "Playwright DOM", "url": website})
        if not findings["mobile"]["contact_action"] and findings["mobile"]["form_count"] == 0 and findings["mobile"]["booking_links"] == 0:
            observed.append({"issue": "No machine-detected direct contact, form or booking action on homepage",
                             "detail": "Could be available on subpages or via JavaScript", "method": "Playwright homepage DOM", "url": website})
        return {"state": "observed", "checked_at": TODAY, "website": website, "devices": findings,
                "objective_issues": observed, "screenshots": "Attached as private GitHub Actions run artifact (browser screenshots).",
                "visual_design_review": "human_review_required", "website_score": None}
    except Exception as exc:
        return {"state": "failed", "reason": type(exc).__name__ + ": " + str(exc)[:160],
                "visual_design_review": "not_completed", "website_score": None}


def dated_announcement_signals(lead, discovery):
    """Extract dated announcements only when title, body and date support claim.
    Fuzzy snippets and undated search hits are NOT verified buying signals.
    """
    if requests is None: return []
    from bs4 import BeautifulSoup
    full_name = normalized(lead.get("name"))
    if len(full_name) < 8: return []
    candidates = (discovery.get("candidates") or [])[:8]
    opening = ("nove otevreno", "otevreni", "otevreli", "grand opening", "novy salon", "new location", "newly opened")
    hiring = ("hledame", "nabor", "hiring", "join our team", "prijmeme", "volna pozice")
    expansion = ("rozsirujeme", "expanze", "new branch", "nova pobocka", "rozsireni")
    claims = [("opening_announcement","Dated opening announcement",opening),
              ("hiring_announcement","Dated hiring announcement",hiring),
              ("expansion_announcement","Dated expansion announcement",expansion)]
    found = []
    checked = 0
    for result in candidates:
        title = normalized(result.get("title"))
        # Evidence must mention the full distinct business name in title.
        if full_name not in title or not any(k in title for _,_,words in claims for k in words):
            continue
        link = result["url"]
        if is_directory(link) or not valid_business_url(link):
            continue
        checked += 1
        if checked > 3: break
        page, err = retrieve(link, timeout=10)
        if not page: continue
        soup = BeautifulSoup(page["html"],"html.parser")
        dates = []
        for key in ("article:published_time","datePublished","pubdate","date","og:updated_time"):
            for meta in soup.find_all("meta",attrs={"property":key})+soup.find_all("meta",attrs={"name":key}):
                value=str(meta.get("content") or "")[:10]
                if re.fullmatch(r"\d{4}-\d{2}-\d{2}",value):
                    dates.append(value)
        if not dates:continue
        date=dates[0]
        try: age=(dt.date.fromisoformat(TODAY)-dt.date.fromisoformat(date)).days
        except ValueError:continue
        if age<0 or age>730:continue
        body = normalized(soup.get_text(" ",strip=True)[:45000])
        if full_name not in body or not ("praha" in body or "prague" in body):continue
        for kind,claim,words in claims:
            if any(word in title for word in words) and any(word in body for word in words):
                found.append({"claim":claim,"category":kind,"date":date,
                              "url":page["url"],"evidence_type":"dated_source_article",
                              "verification_rule":"Business name in article title and text; keyword and dated publication"})
                break
    return found[:3]


def dossier(lead, discovery, audit, reg, signals):
    industry = lead.get("industry", "local services")
    found = discovery.get("state") == "verified_website"
    issues = audit.get("objective_issues", [])
    lead_name = lead.get("name", "Business")
    factual = [
        "The business is listed at " + lead.get("address", "an unverified Prague address") + ".",
        ("An independently identity-matched business website was found: " + discovery["website"] + "."
         if found else "Independent searches did not verify a standalone business website. This is NOT proof no website exists."),
    ]
    if reg.get("state") == "registry_found":
        factual.append("ARES confirms registration for IČO " + reg["ico"] + " dated " + str(reg.get("registered_at") or "unknown") + ".")
    if issues:
        factual.append("Browser-observed issue: " + issues[0]["issue"] + ".")
    pitch = str(lead.get("offer") or "Responsive service website with clear contact or booking actions")
    if found and issues:
        angle = "Show a measured " + issues[0]["issue"].lower() + " fix in a private demo, and ask if improving enquiries is a priority."
    elif found:
        angle = "Review existing website with the owner and establish a real unmet conversion goal before proposing a redesign."
    else:
        angle = "Confirm current official website and booking channel with the business before proposing a website."
    sources = list(dict.fromkeys([s for s in lead.get("source_urls", []) if s.startswith("https://")] +
                                 ([reg["source"]] if reg.get("source") else []) +
                                 ([discovery["website"]] if found else [])))
    limitations = ["No search can conclusively prove a business has no website.",
                   "Buyer interest, project budget and decision-maker authority are not yet verified."]
    if audit.get("visual_design_review") != "reviewed":
        limitations.append("Screenshots and DOM observations are not a human/AI aesthetic design review.")
    return {"title": lead_name + " — research dossier", "facts": factual,
            "offer": pitch, "outreach_angle": angle, "observed_issues": issues,
            "buying_signals": signals, "sources": sources[:12],
            "estimated_deal_czk": [lead.get("deal_min_czk"), lead.get("deal_max_czk")],
            "decision_maker": reg.get("decision_maker"),
            "decision_maker_status": "Unverified — registry official-director identification not automated",
            "confidence": "preliminary", "limitations": limitations}


def pick_queue(leads, old_reports):
    unique, seen = [], set()
    manual = [l for l in leads if l.get("manual")]
    rest = [l for l in leads if not l.get("manual")]
    def weight(l):
        listed = bool(l.get("website"))
        contact = bool(l.get("email") or l.get("phone") or l.get("instagram"))
        prior = old_reports.get(l["id"], {})
        stamp = prior.get("checked_at", "")
        age = 0 if not stamp else (dt.date.fromisoformat(TODAY) - dt.date.fromisoformat(stamp)).days
        return (l.get("verification") not in ("inactive_registry","rejected","closed"),
                bool(l.get("address") and l["address"] != "Praha"), contact, age >= 7, bool(l.get("ico")),
                not listed, int(l.get("score") or 0))
    rest.sort(key=weight, reverse=True)
    for l in manual + rest:
        if l.get("verification") in ("closed","rejected","inactive_registry"):
            continue
        if CHAIN_RE.search(l.get("name","")): continue
        if not any(l.get(k) for k in ("phone","email","instagram")): continue
        key = l.get("ico") or (normalized(l.get("name"))+"|"+normalized(l.get("address")))
        if key in seen:continue
        seen.add(key)
        previous = old_reports.get(l["id"],{})
        if previous.get("checked_at")==TODAY:continue
        unique.append(l)
        if len(unique)>=PER_DAY:break
    return unique


def run():
    leads_doc = json.loads(LEADS.read_text(encoding="utf-8"))
    manual_doc = json.loads(MANUAL.read_text(encoding="utf-8"))
    old = json.loads(OUTPUT.read_text(encoding="utf-8")) if OUTPUT.exists() else {"reports":{}}
    old_reports = old.get("reports",{})
    all_leads = {l["id"]:l for l in leads_doc["leads"]}
    all_leads.update({l["id"]:{**l,"manual":True} for l in manual_doc.get("leads",[])})
    queue = pick_queue(list(all_leads.values()),old_reports)
    print("Research candidates today:",len(queue),"from",len(all_leads),"leads",flush=True)
    if not requests:
        raise RuntimeError("requests dependency required; see requirements-research.txt")
    errors=[]
    completed=0
    for lead in queue:
        ident=lead["id"]
        print("Researching",ident,lead["name"],flush=True)
        try:
            discovery=discover_website(lead)
            reg=registry(lead)
            audit=(browser_audit(discovery["website"],ident)
                   if discovery.get("state")=="verified_website"
                   else {"state":"not_run","reason":"No independently verified company website"})
            signals=[]
            if reg.get("state")=="registry_found" and reg.get("registered_at"):
                try:
                    age=(dt.date.fromisoformat(TODAY)-dt.date.fromisoformat(reg["registered_at"])).days
                    if 0<=age<=730:
                        signals.append({"claim":SIGNALS["new_registration"],"url":reg["source"],
                                        "date":reg["registered_at"],"evidence_type":"verified_registry"})
                except ValueError:pass
            signals.extend(dated_announcement_signals(lead,discovery))
            # Search results are research leads; only article-and-date-verified signals are facts.

            candidate_sources=[x["url"] for x in discovery.get("candidates",[])[:7]]
            report={"lead_id":ident,"name":lead["name"],"checked_at":TODAY,
                    "state":"audited" if audit.get("state")=="observed" else "researched",
                    "discovery":discovery,"registry":reg,"audit":audit,"buying_signals":signals,
                    "dossier":dossier(lead,discovery,audit,reg,signals),
                    "candidate_search_sources":candidate_sources,
                    "website_need_verified":bool(audit.get("objective_issues")),
                    "contact_method":("matched_business_website" if discovery.get("contact_matches") else "public_listing_not_owner_verified"),
                    "contact_evidence":discovery.get("contact_matches",[]),
                    "owner_verified":False, "buyer_interest_verified":False}
            old_reports[ident]=report
            completed+=1
        except Exception as exc:
            errors.append({"lead_id":ident,"error":type(exc).__name__+": "+str(exc)[:180]})
            print("Research candidate error:",ident,errors[-1]["error"],file=sys.stderr)
    # Prune stale reports and cap size.
    ranked=sorted(old_reports.values(),key=lambda x:x.get("checked_at",""),reverse=True)
    cutoff=(dt.date.fromisoformat(TODAY)-dt.timedelta(days=45)).isoformat()
    old_reports={x["lead_id"]:x for x in ranked if x.get("checked_at","")>=cutoff and x.get("lead_id") in all_leads}
    old_reports=dict(list(old_reports.items())[:180])
    output={"schema_version":2,"generated_at":dt.datetime.now(dt.timezone.utc).isoformat(),
            "mode":"evidence_based_no_ai","status":"completed" if not errors else "partial",
            "searched_today":len(queue),"completed_today":completed,
            "limits":{"web_discovery":"No negative proof from search","browser":"Objective DOM and geometry only",
                      "buyer":"No purchase intent or owner authority inferred"},
            "errors":errors,"reports":old_reports}
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    OUTPUT.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("Wrote",OUTPUT,"reports:",len(old_reports),"completed",completed,flush=True)


if __name__=="__main__":
    run()
