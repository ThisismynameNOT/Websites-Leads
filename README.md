# Fieldnotes — Prague Website Sales Radar

Automated, GitHub-native sales prospecting dashboard for web design opportunities in Prague.

**Source repo:** https://github.com/ThisismynameNOT/Websites-Leads

## Available now

- Mobile-responsive sales dashboard, search, industry filters, opportunity rankings and lead dossiers.
- CSV export; saved prospects, notes and outreach stages stored locally in your browser.
- Six collection windows daily: 00:17, 04:17, 08:17, 12:17, 16:17 and 20:17 **UTC** (four-hour cadence).
- OpenStreetMap listing research limited to the administrative city of Prague.
- Six rotating industry groups: beauty, food, professional services, trades, retail and wellness.
- Optional ARES business-registration checks when the directory lists an IČO.
- Dedupe, JSON persistence, source links, manual lead merges and offline unit tests.
- GitHub Actions collector and GitHub Pages publisher.

## First-time activation

1. In the [GitHub Actions tab](https://github.com/ThisismynameNOT/Websites-Leads/actions), choose **Refresh Prague leads** then **Run workflow** to collect the initial candidates. The scheduled workflow also runs automatically once Actions is active.
2. Open [Settings → Pages](https://github.com/ThisismynameNOT/Websites-Leads/settings/pages) and set **Build and deployment → Source → GitHub Actions**.
3. Choose **Publish lead dashboard → Run workflow** in Actions. When it succeeds, GitHub Settings → Pages will show your actual live URL.
4. If the collector cannot commit data, review **Settings → Actions → General → Workflow permissions** and ensure the workflow token has repository write permission.
5. The repository is **private**. GitHub Pages from a private repo requires an eligible GitHub Pro/Team/Enterprise plan; GitHub Free generally cannot host Pages from a private repo. Even when source remains private, the *published site* may be public to anyone with the link. Do not publish private sales notes or nonpublic contact data.

Do not assume the site is published until the Pages workflow succeeds.

## Where leads come from

The Python collector reads OpenStreetMap records for businesses within Prague's city boundary via the Overpass API. At most 230 new candidates are retained per run, with a maximum of 1800 deduplicated candidates in the dataset. It rotates between six industry groups each four hours. ARES is queried on a subset of newly discovered companies that have an IČO on their map record.

**Integrity rules:**

- Website status **not_listed** means no website URL in the source listing. It does NOT establish that the business has no website.
- The date **first_seen** means when the collector discovered the lead, not when the business opened.
- **registered_at** must come from ARES, and **opened_at** stays unknown unless manually verified.
- **website_score** stays unknown until a genuine human/screenshot audit is completed.
- Automated 0–100 scores are cautious sector/contactability estimates, not predicted close rates.
- Public listing data may contain stale information, and all candidates require validation before outreach.
- The pipeline is not a replacement for Google Maps/Instagram research, mobile audits, or human sales qualification.
- When a discovery source times out, an existing successful lead snapshot is preserved.

### Scoring

Score factors: website-need evidence (30 possible), recent registration (20), estimated industry value (20), contactability (15), and presence gap (15). The automatic pipeline gives **15/30** for an unlisted directory website, **not 30**, because lack of a directory URL is not proof of no website.

## Add manually researched leads

Open [manual-leads.json](https://github.com/ThisismynameNOT/Websites-Leads/edit/main/data/manual-leads.json) and add entries inside the existing leads array. Example only (replace with verified information before committing):

    {
      "leads": [
        {
          "id": "manual-example-001",
          "name": "Replace with verified company name",
          "industry": "Construction & property",
          "district": "Praha 5",
          "address": "Verified street address",
          "ico": "",
          "website": "",
          "website_status": "unknown",
          "email": "",
          "phone": "",
          "registered_at": null,
          "opened_at": null,
          "website_score": null,
          "verification": "researching",
          "score": 50,
          "reason": "What I actually checked",
          "source_urls": ["https://example.com/public-source"],
          "offer": "Professional business website",
          "deal_min_czk": 25000,
          "deal_max_czk": 50000,
          "demo_potential": "Medium",
          "first_seen": "2026-10-08"
        }
      ]
    }

Committing edits here triggers data refresh. The collector merges manual entries into the automated data. Never put placeholder example records into a production pipeline.

## Project layout

- index.html — HTML dashboard
- styles.css — layout and styling
- app.js — search, sorting, lead dossiers, CSV export and browser-only CRM
- data/leads.json — collector-managed candidate records
- data/manual-leads.json — manually reviewed/curated prospects
- scripts/refresh.py — Python collector (standard library, no secrets)
- tests/test_collector.py — offline tests
- .github/workflows/collect.yml — scheduled lead collection + git commit
- .github/workflows/deploy.yml — GitHub Pages deployment

## Running locally

To preview, run **python -m http.server 8000** from the repository root and open http://localhost:8000. Do not open the dashboard with file:// because browser data fetches are restricted.

To run offline tests: **python -m unittest discover -s tests -v**

To trigger the collector locally with internet access: **python scripts/refresh.py**

The browser checks for a new lead snapshot every 15 minutes while visible. Source collection is scheduled every four hours in GitHub Actions; GitHub may delay scheduled runs or skip them under heavy load.

## Attribution, privacy, limitations

**Business listing data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), licensed under the Open Database License (ODbL).** OSM objects include their source URL in the lead dossier. ARES lookup records include the public registry URL.

Only use public business contact information. Respect Czech/EU law in outreach. Local CRM notes are **not synced** across browsers. Export CSV to retain a backup. Published GitHub Pages is **not a secure private CRM** without separate access control.
