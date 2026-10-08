# Registry-first rebuild — implementation and verification report

**Date:** 2026-10-09 (Prague local date). **Repository:** https://github.com/ThisismynameNOT/Websites-Leads

## Executive outcome

An upgraded pipeline has been committed without replacing the dashboard, CRM, CSV export or GitHub Pages publisher. Official ČSÚ RES CSV ingestion and two age cohorts, strict ARES-before-site research, evidence-based audits, a unified six-factor 100-point commercial score, and safe JSON publication have been added.

**Verification is deliberately split:** the fast offline CI passed; the public Pages site passed a real HTTP smoke test; the first full live ČSÚ ingest is still pending its separate workflow result. Do NOT count code added as proof a real official snapshot was successfully imported.

## Source status

| Source | Current integration | Evidence / action |
|---|---|---|
| Official ČSÚ RES | Implemented, awaiting verified live snapshot | Streaming official CSV schema; comparison index for selected Prague priority sectors. See data/res-candidates.json generated_at. |
| Official ARES | Operational in earlier independent research | Official IČO lookup validated 9 prior business records in the earlier live report; new sequencing to verify before website search awaits fresh run. |
| OpenStreetMap | Operational, secondary | Previously discovered Prague businesses; supplemental locations and contacts. |
| Justice.cz public documents | Manual-only, not scraped | Official dated revenue/profit references can be entered via financial-evidence.json. |
| Chytrý Rejstřík | Requires optional paid API access and explicit approval | Documented authenticated profile/filter API, not enabled. |
| FakturujZdarma / Peníze.cz / DoStartu / Firmy.cz / Finmag | Permission/official feed not confirmed | Manual sources only. No unpermitted crawling; see data/sources.json. |

## Two verified-first discovery cohorts

- Newly registered: source date last 7/30/90/365/730 days, not a CSV first-appearance flag.
- Established: older, active and credible businesses with measured website redesign opportunity; age never automatically rejects.
- Priority sectors: tier 1 construction/renovation/trades/property; tier 2 manufacturing, automotive, specialized services; tier 3 optional beauty/hospitality/retail.
- IČO is the deduplication key when present. HQ registration is not treated as proof of the trading premises.

## Unified commercial qualification

| Factor | Maximum |
|---|---:|
| Website improvement evidence | 25 |
| Financial capacity (dated and sourced) | 25 |
| Activity / credibility | 20 |
| Lead-generation value | 15 |
| Business contact | 10 |
| CMS suitability | 5 |
| Total | 100 |

80–100 high-priority prospect; 60–79 further qualification; below 60 low priority. Qualification status is separately gated by evidence, not numeric score. Public website pricing estimates are *not* buyer budget or revenue.

## Changed/new files

- New: scripts/res_ingest.py, scripts/qualify.py, scripts/safe_publish.py, scripts/smoke_dashboard.py
- Updated: scripts/refresh.py, scripts/research.py, picks.js, app.js, index.html, styles.css
- New data: data/res-candidates.json, data/res-state.json, data/qualification.json, data/financial-evidence.json, data/sources.json
- Updated GitHub Actions: .github/workflows/collect.yml, .github/workflows/deploy.yml
- New CI: .github/workflows/check.yml
- New tests: tests/test_res_ingest.py, tests/test_qualify.py, tests/test_safe_publish.py
- Updated tests: tests/test_research.py and tests/picks.test.cjs
- Documentation: README.md, SOURCE_INTEGRATIONS.md, RESEARCH_PIPELINE.md, REBUILD_REPORT.md

## Confirmed test results

- Fast CI passed **35 Python tests**, plus **12 Node.js shortlist tests**, with no failures. Run: https://github.com/ThisismynameNOT/Websites-Leads/actions/runs/37855547755
- The Python suite tests ČSÚ fixtures, geography, dates, snapshot change vs founding, score limits, unknown financial capacity, no-site-finding uncertainty, ARES gating, and safe merged publication.
- A real GitHub Pages deployment and live HTTP data smoke passed: https://github.com/ThisismynameNOT/Websites-Leads/actions/runs/37855453410
- The successfully published live site contained **1,429 existing leads** on that run; this is NOT a count of official newly registered ČSÚ leads.
- Full workflow with official RES ingestion, daily browser UI smoke, safe publication and refreshed qualification: https://github.com/ThisismynameNOT/Websites-Leads/actions/runs/37855608662 — status pending at initial report time.

## Outstanding validation / limitations

1. Official large CSV download and real-source candidate counts must succeed before claiming the primary RES discovery source operational.
2. Browser smoke of CRM, CSV and source filters must complete inside the full collector job.
3. New public registry representative checks and source-specific website matches need validation on the next full research run.
4. Real revenue, profitability and buyer budget cannot be automatically inferred; source-backed accounts/contract records are needed or financial capacity remains NOT VERIFIED.
5. No search can prove there is no business website anywhere. Browser DOM tests do not establish subjective visual quality.
6. Third-party registries without documented permitted exports or API rights remain manual-only; Chytrý API is not purchased or activated.
7. Scheduled GitHub Actions at 09:00 Europe/Prague may start late. Source ingestion updates only when the official approximately twice-monthly snapshot changes.

Never treat this as proof of complete coverage of all Czech registered businesses. The RES ingestion outputs a bounded Prague, priority-sector sample.
