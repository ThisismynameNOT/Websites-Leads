# Evidence-first research pipeline

The dashboard does not use ChatGPT automatically. GitHub Actions runs Python scripts at **09:00 Europe/Prague** daily.

## Automated flow

1. Discovery: scripts/refresh.py collects Prague businesses from OpenStreetMap and checks listed IČOs with ARES. Stores them in data/leads.json.
2. Research: scripts/research.py investigates up to 12 candidates daily, prioritizing curated records and other suitable businesses. Writes per-lead reports to data/research.json.
3. Publisher: the GitHub Pages workflow copies the dashboard and three datasets, then tests the live site.
4. Dashboard: app.js merges evidence; picks.js ranks the top three with the original 16 restrictions. A prospect is marked **Research required** until complete qualification.

## Eight research capabilities

| Capability | Automated method | Truth boundary |
|---|---|---|
| Prague candidate discovery | City-scoped OpenStreetMap queries and rotating sectors | Directory listings are not always current |
| Independent website search | Czech/English web searches using free ddgs or optional Brave Search API | Failure to find a domain does NOT prove no site exists |
| Official-site identity matching | Retrieved site must match IČO, or name AND Prague street | Ambiguous directories excluded; mismatches stay unknown |
| Real browser audit | Playwright desktop/mobile visits, DOM metrics, visual screenshots | Objective issues only; no unobserved visual-design conclusions |
| Registry verification | Official ARES lookup by listed IČO and public-register (VR) statutory-member structure | Registered director is not necessarily marketing buyer |
| Public contact cross-check | Listed email/phone matched against official-site content | Deliverability and buying authority need human confirmation |
| Evidence-backed buying signals | Recent ARES registration or dated, source-checked opening, hiring or expansion news | Unsupported rumors and undated claims omitted |
| Personalized sales dossiers | Deterministic synthesis of public facts, audited issues, citations, offering and pitch angle | No AI key necessary; unproven intent and budget never asserted |

The researcher preserves an explicit report of unsupported information. It cannot logically certify that no website exists anywhere, that a named executive will buy a website, or that any company has an available budget. Rather than fake these facts, it labels the missing checks for a human or the initial sales call.

## Evidence review

Open a lead's dossier and scroll to **Independent research & evidence**. It includes the search status, matching website identity, technical observations, ARES registration/director (when returned), dated business signals, references and a sourced pitch.

Desktop and mobile WebP screenshots are stored in the **daily-website-audit-screenshots** artifact for each collector run, retained for 14 days; they are not published on the public GitHub Pages site.

## Search service configuration

No additional account is strictly required: the default search library is ddgs. This free metasearch option can occasionally be blocked or rate-limited.

For dependable authenticated search, supply a Brave Search API key through Repository Settings → Secrets and variables → Actions. Secret name: **BRAVE_SEARCH_API_KEY**. This is optional and not stored in repository code. Check the provider's current fees and quotas.

## Automated quality checks

Daily workflow:

    python -m compileall -q scripts tests
    python -m unittest discover -s tests -v
    python scripts/refresh.py
    python scripts/research.py

Deployment workflow:

    node --check public/app.js
    node --check public/picks.js
    node --test tests/picks.test.cjs

GitHub Actions scheduling is best effort and may run late; it does not guarantee a report is published at exactly 09:00.

## Privacy and source attribution

The repository and Pages data are public. Only store public business contact details, no customer notes or private person data. Director fields are limited to publicly registered name and role, no home addresses or birthdates. Public business records do not authorize mass unsolicited marketing under Czech/EU law.

Screenshots are human-review evidence, not claims that a site's design is ugly. A visually professional judgement remains subjective and must be checked before suggesting a redesign.
