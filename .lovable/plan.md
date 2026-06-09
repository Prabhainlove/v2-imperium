# Job Discovery Recovery — IMPLEMENTED

## What changed
- **Ranking** (`JobRankingService.server.ts`): `classifyExperience` now returns `ExperienceBucket | null` (no more "3-5" default). Unknown experience = small penalty, NOT a hard filter. Strict role families with cross-family `titleMismatch`. Location tiers: same_city(1.0) > same_state(0.85) > remote(0.75) > same_country(0.5) > other(0.1). Severe penalty for foreign on-site when user is in India. Freshness curve: ≤1d=1.0, ≤7d=0.75, ≤30d=0.3, >30d=0.08.
- **Top 5** (`JobNormalizationService.server.ts`): requires `!titleMismatch && score≥0.5 && freshnessDays≤30 && tier∈{same_city,same_state,remote,same_country}`. Never pads.
- **API filter** (`jobs.api.ts`): experience hard-filter now keeps null buckets.
- **Sources** (`JobSources.server.ts`):
  - Naukri: UA pool, retry-with-jitter, HTML fallback scraper on JSON failure.
  - LinkedIn: 4-page pagination (0/25/50/75), UA rotation, seniority capture.
  - New adapters: Foundit, Wellfound (`__NEXT_DATA__`), YC (JSON-LD), Instahyre, Hirist (`__NEXT_DATA__`). All degrade to `[]` on failure.
  - Registry reordered: India-focused sources first.
- **Retrieval** (`JobRetrievalService.server.ts`): location expansion city → state → "India" → "Remote India", stops when ≥5 unique jobs.
- **Debug trace** (`/api/public/debug/jobs-trace`): per-source timing/error, raw classification (jobFamily, locationTier, experienceBucket), removal reasons, Top-5 verdict per job.

## Validation
Run with `DEBUG_JOBS_TRACE=1`:
```
POST /api/public/debug/jobs-trace
{"title":"Front End","location":"Hyderabad","experience":"fresher"}
```
Expect: Naukri/Foundit/Instahyre/Hirist contributing rows, frontend-family titles in Top 5, no AI/Backend/Germany-on-site leakage.
