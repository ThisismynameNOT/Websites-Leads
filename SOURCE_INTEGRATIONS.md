# Czech lead data integrations — permissions, completeness and quality

The source-of-truth integration status is published in [data/sources.json](./data/sources.json). No scraping of protected third-party listing pages is performed automatically.

| Source | Status | Method | Notes |
|---|---|---|---|
| ČSÚ RES | Implemented; live CSV import awaiting verified successful run | Official open CSV, streamed; twice-monthly publication | Large ~540MB snapshot; Prague/CZ-NACE filtering and bounded new/established candidate sample. Registered office ≠ operating location. |
| Czech ARES | Integrated; used in prior live runs | Official economic-subject REST API | Identifies legal entity by IČO; not proof of commercial budget. |
| ARES public-register VR | Best-effort structured lookup | Official REST interface when available | Current statutory members shown with source. Director ≠ purchasing authority. |
| Justice.cz filings | Manual verification only | Official public documents | No verified machine-readable bulk finance API has been enabled. Only attributable annual reports may enter financial evidence. |
| Chytrý Rejstřík | Requires explicit subscription approval | Its published authenticated filter/profile API | Published API requires bearer token and enforces quotas; do not enable paid queries without approval. |
| FakturujZdarma | Manual-only pending permitted export/permission | No automatic crawler | Licensing, robots and export rights have not been confirmed. |
| Peníze.cz newest entities | Manual-only pending permitted export/permission | No automatic crawler | Not treated as a complete/new incorporation feed. |
| DoStartu business register | Manual-only pending permitted export/permission | No automatic crawler | No verified licensed API/export. |
| Firmy.cz | Cross-check source; no directory spider | Manual links and independent search results | Robots rules are path/agent-specific; no permission inferred from accessible webpages. |
| Finmag | Cross-check source; no automated scrape | Public result links/manual verified facts | Bulk licence not established. |
| OpenStreetMap | Secondary automated supplement | Overpass Prague boundary with 6 rotating sectors | A missing website tag is not proof of no site; ODbL attribution preserved. |

## Official ČSÚ fields and change handling

Official CSV URL: https://opendata.csu.gov.cz/soubory/od/od_org03/res_data.csv
Schema: https://opendata.csu.gov.cz/soubory/od/od_org03/res_data-metadata.json
Documentation: https://csu.gov.cz/registr-ekonomickych-subjektu-otevrena-data-dokumentace

- ICO, FIRMA, DDATVZN, DDATZAN, DDATPAKT, OKRESLAU, OBEC_TEXT, NACE2025/NACE, ROSFORMA/FORMA, KATPO and PRIZNAK are parsed from the official documented schema.
- Only the Prague (CZ0100) registered-office district or exact municipality Praha is accepted; Praha-východ and Praha-západ are excluded.
- New companies are filtered by actual DDATVZN, not PRIZNAK. An old company with PRIZNAK=P remains established.
- Snapshot comparison indexes only a bounded published subset. It does not claim complete historical or nationwide coverage.
- A source outage retains prior valid outputs. The daily job can still use previously imported candidates; no fake live result is created.

## Two pipelines, one qualification

New companies: 7/30/90/365/730 days from documented registration (or separately sourced actual opening).
Established: older active company, verified web need and credible commercial evidence. Company age must not disqualify.
Both use the same 25 + 25 + 20 + 15 + 10 + 5 evidence-based model from scripts/qualify.py.

Financial proof must be dated, publicly attributable and entered as official filed accounts or public contract award in data/financial-evidence.json. Do not treat KATPO employee categories or a proposed website price as verified revenue, profitability or confirmed buyer budget.

## Operator checklist

1. Verify Refresh Prague leads workflow passed Python unit tests.
2. Verify data/res-candidates.json has a non-null generated_at, a real source timestamp and nonzero published_new / published_established counts.
3. Confirm data/research.json has genuinely matched business domains, browser metrics and public registry evidence.
4. Confirm data/qualification.json is populated and sums all six categories to the displayed score.
5. Verify Publish lead dashboard passed smoke tests and the site correctly filters company cohorts.
6. Review screenshots and any manual financial statement before contacting a company. Keep CRM notes in the browser, not the public repo.

Never claim automated data access to commercial sites, accurate revenue figures, or all Czech businesses without evidence.
