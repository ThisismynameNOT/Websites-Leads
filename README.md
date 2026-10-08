# Fieldnotes — Prague Website Sales Radar

Automated, GitHub-native sales prospecting dashboard for web design opportunities in Prague.

**Source repo:** https://github.com/ThisismynameNOT/Websites-Leads

## Commercial website-fit search improvements

The ten-place radar now separates **source-backed website gaps** from **commercially promising clients to investigate**. The latter are *research hypotheses*, not verified redesign defects, confirmed budgets or proof of customer interest.

- Higher-value Prague builders, roofing firms, electricians, HVAC, architectural/professional and specialist B2B operators receive research priority over generic directory listings. The daily researcher balances recent formations and established companies, caching completed research for 14 days (3 days after search unavailability) before repeating it.
- Independent website searches use legal/trading name, exact IČO, Prague activity, street and service keywords, with bounded queries and a recorded successful-query count. Partial searches cannot be promoted to no-website findings.
- The dashboard reserves up to **three of ten places** for promising companies whose identity, industry/contact or sourced human review supports potential portfolio, CMS, or quote-request work. These rows are labeled **Good website client · needs review**. Confirm the real business, the site, the buyer's need and affordability before outreach.
- A manual case can be seeded only with its IČO, two independent source URLs, dated research notes and an explicit business case. The first curated candidate is ELEFANT - PRAHA, s.r.o., based on company website reference pages and public company-register evidence. Its current site's technical quality and budget are **not** verified.
- Raw registry-only companies without evidence of operations, business contacts or an independently matched site are still excluded from the visible ten, even if they exist in the background feed.

The daily research cap is **16 businesses**, subject to existing network and GitHub Actions time limits. No third-party directory scraping or paid API was added.

## Top-ten opportunity radar (October 2026)

The public GitHub Pages dashboard displays **up to ten evidence-backed sales opportunities**, not the complete 1,800-record discovery database. Raw leads remain available in `data/leads.json` for automated research, but are not shown as prospects until a specific website-opportunity condition has supporting evidence. Search/filter controls were removed from the dashboard intentionally.

- **New businesses (up to 24 months):** Completed independent website research found no confirmed first-party company website or only third-party presence. This is **not proof that no website exists**.
- **Established businesses:** A first-party company website was identity-matched and a Playwright audit recorded material objective issues (e.g. mobile overflow, broken pages) or an observed HTTP page with an unsuccessful same-host HTTPS probe.
- **Directory exclusion:** Search hits from company-listing sites, finance registries and social profiles are never audited or scored as the company's own website. HTTP observations do not establish permanent security exposure and should be rechecked before outreach.
- Unfilled slots remain clearly pending rather than automatically promoting low-confidence businesses. Three spotlight cards use the highest three of the ten; source evidence and qualification remain in each company dossier. Private CRM notes, saved status and exported shortlist data are retained.
- Technical defects can be measured automatically. Subjective judgements like “horrible design”, buyer budget or readiness to purchase **require separate evidence or human evaluation**.

Top-ten selector: `opportunity.js`. Offline tests: `tests/opportunity.test.cjs`. Browser regression: `scripts/smoke_dashboard.py`. Daily collector remains at 09:00 Prague time; additional AI-assisted review task runs separately.

## Official Czech registry discovery and qualification

Registry-first path: official ČSÚ RES open CSV → ARES identity verification → independent website searches → measured browser/financial/commerce evidence → one 100-point qualification model → top three.

- New companies (last 7, 30, 90, 365 or 730 days) and established companies are supported. Older companies are NOT disqualified just because of age.
- The official ČSÚ RES CSV is published twice monthly. Its P record-change flag is not synonymous with new incorporation. The automated importer processes a bounded Prague-sector sample, not all registered Czech businesses.
- RES ingestion is in scripts/res_ingest.py, supplemental OSM reconciliation in scripts/refresh.py, evidence research in scripts/research.py, finance-aware scoring in scripts/qualify.py, and safe Git publication in scripts/safe_publish.py.
- Qualified scores are published in data/qualification.json and shared by directory and top-three lists. Weights: website 25, finance 25, activity 20, lead value 15, contact 10, CMS 5.
- Financial claims require dated public documents in data/financial-evidence.json. Without real evidence financial capacity is explicitly not verified and receives zero financial points.
- data/sources.json clearly identifies official automation, manual-only sources and paid API options requiring approval.
- Public Pages, local notes/CRM, CSV export, manual leads and responsive visual design are preserved.

CAUTION: The ČSÚ CSV is a large download. Do not claim it successfully imported until data/res-candidates.json has a non-null generated_at and counts from a live workflow. The search fallback may be rate-limited. Existing snapshots are retained when upstream sources fail.

Read [Source Integrations](./SOURCE_INTEGRATIONS.md) and [Research Pipeline](./RESEARCH_PIPELINE.md) for limits and configuration.

## Evidence-first research upgrade (October 2026)

**Daily automatic research now includes** independent website search, official ARES verification, current registry-member lookup when available, browser measurements of desktop/mobile layouts, screenshots in workflow artifacts, cross-checks of listed business contacts, dated opening/hiring/expansion signals, and source-grounded personalized sales dossiers.

All new research appears inside the company's dossier in the dashboard. The top three now prioritize recently observed, measurable website issues rather than only source-directory scores.

**Important:** no web search can prove nonexistence of a website; code-driven screenshots cannot conclusively evaluate aesthetics; public directors may not be purchasing decision-makers; buyer budget and intent require direct confirmation. Unsupported claims remain labelled unknown or research required, rather than being invented.

For the exact research methodology, limitations, optional authenticated search configuration, data schema, screenshot access, and tests, read **[RESEARCH_PIPELINE.md](./RESEARCH_PIPELINE.md)**.

## Available now

- Mobile-responsive sales dashboard, search, industry filters, opportunity rankings and lead dossiers.
- CSV export; saved prospects, notes and outreach stages stored locally in your browser.
- Daily collection scheduled at **09:00 every morning in Europe/Prague**, automatically following CET/CEST daylight-saving time.
- Registry-first ČSÚ RES discovery of Prague companies, with OpenStreetMap as supplementary location evidence.
- Six rotating industry groups: beauty, food, professional services, trades, retail and wellness.
- Optional ARES business-registration checks when the directory lists an IČO.
- Dedupe, JSON persistence, source links, manual lead merges and offline unit tests.
- GitHub Actions collector and GitHub Pages publisher.

## First-time activation

1. The repository is **public**, and the first Prague candidate collection has already succeeded. Further collector runs are scheduled automatically at 09:00 Prague time every day.
2. Open [Settings → Pages](https://github.com/ThisismynameNOT/Websites-Leads/settings/pages) and set **Build and deployment → Source → GitHub Actions**.
3. Choose **Publish lead dashboard → Run workflow** in Actions. When it succeeds, GitHub Settings → Pages will show your actual live URL.
4. If the collector cannot commit data, review **Settings → Actions → General → Workflow permissions** and ensure the workflow token has repository write permission.
5. This repository is **public**, so GitHub Pages is available on GitHub Free. **Everything committed to this repo and the Pages lead JSON can be read by anyone**. Keep personal sales notes inside the dashboard's browser-only storage. Do not commit nonpublic contact information, secrets, or client data.

Do not assume the site is published until the Pages workflow succeeds.

## The daily three-pick shortlist

The dashboard places **exactly three prospects** above the full directory. The picker runs against the daily refreshed dataset and prefers researched, public-source-supported businesses over generic OSM entries. A prospect is marked **Research required** until all qualification checks are actually completed. An empty slot is shown if there are fewer than three acceptable candidates; the system never invents companies to reach three.

The initial researched picks (checked 8 October 2026) are **An Beauty Studio**, **Marina Hreben**, and **Café Marathon**. All three are provisional; none is yet verified to lack a separate website or booking system. Relevant original research links and explicit next-check gaps are included in \`data/manual-leads.json\`. They are not automatically approved for outreach.

### The 16 enforced restrictions

1. **Prague only:** real operation inside Prague administrative limits, not Central Bohemia or a remote-only business.
2. **Age cohorts:** both newly registered and established companies are eligible; older companies need real redesign evidence, not an age exception.
3. **Existence and activity:** verify a legitimate currently operating business with its correct address.
4. **Sector focus:** construction/property, beauty/wellness, independent hospitality, professional services, automotive, related sectors.
5. **Independent buyer:** exclude corporate brands, huge chains, franchises, banks, government entities and complex mature digital brands.
6. **Website need:** independently verify absence, a real deficiency, or an actual customer journey gap; directory omissions alone prove nothing.
7. **Factual UX audit:** do not invent website scores, speed measurements, broken pages, SEO/mobile defects or missing CTAs.
8. **Public contacts:** a real public business contact channel; aim to confirm the actual buyer or manager, never guess emails.
9. **Ability to buy:** credible commercial potential and realistically priced scope for a 15,000–90,000+ CZK project.
10. **Buying signals:** document sourced opening, hiring, expansion, marketing, rebrand or customer momentum.
11. **Demo value:** a concrete visual/conversion improvement; obtain permission before using images, logos or personal photos.
12. **Unified priority:** 25 website + 25 finance + 20 activity + 15 lead generation + 10 contact + 5 CMS. 80+ high, 60–79 further research, below 60 low.
13. **No duplicates:** deduplicate by IČO, name, location, domain and connected branches.
14. **Sources/date fidelity:** keep multiple public evidence links, distinguish incorporation/premises dates from actual launch dates.
15. **Exactly three presentation slots:** three picks or clearly unfilled slots; not padded with fabricated verified leads.
16. **Privacy/legal:** public business contact data only, no private notes in committed JSON, respect Czech/EU outreach rules.

Qualification additionally requires an explicitly documented review: \`qualification.city_verified\`, \`active_verified\`, \`contact_verified\`, \`website_need_verified\`, \`commercial_fit_verified\`, \`independent_owner_check\`, \`not_franchise_verified\`, a recent \`last_checked\`, and at least two evidence links. These flags must only be set after actual review. Unverified candidates stay **Research required**.

The site loads \`picks.js\` (standalone selection policy) and \`data/manual-leads.json\` (manually researched evidence) alongside the main daily \`data/leads.json\` feed. The GitHub Pages publisher copies all of these files and runs the policy tests.

## Where leads come from

The Python collector reads OpenStreetMap records for businesses within Prague's city boundary via the Overpass API. At most 230 new candidates are retained per run, with a maximum of 1800 deduplicated candidates in the dataset. It rotates between six industry groups across six successive Prague calendar days, keeping existing leads in the snapshot. ARES is queried on a subset of newly discovered companies that have an IČO on their map record.

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

The browser checks for a new lead snapshot every 15 minutes while visible. Source collection is scheduled at 09:00 Europe/Prague daily in GitHub Actions; GitHub may delay scheduled runs or skip them under heavy load. GitHub may also automatically disable scheduled runs if a public repository has no activity for 60 days.

## Attribution, privacy, limitations

**Business listing data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), licensed under the Open Database License (ODbL).** OSM objects include their source URL in the lead dossier. ARES lookup records include the public registry URL.

Only use public business contact information. Respect Czech/EU law in outreach. Local CRM notes are **not synced** across browsers. Export CSV to retain a backup. Published GitHub Pages is **not a secure private CRM** without separate access control.
