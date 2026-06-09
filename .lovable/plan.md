# Job Discovery — Data Quality Recovery (IMPLEMENTED)

## Pipeline now: retrieve → normalize+validate+rank → filter → cache → UI

### Validation (`JobValidationService.server.ts`, new)
Every raw job is scored before ranking:
- `qualityStatus` ∈ `ok | incomplete | invalid_url | missing_description`
- `qualityScore` 0–100 (description 40 / url 20 / company 15 / location 10 / source 15)
- `descriptionSource` ∈ `jsonld | og | dom | api | placeholder | unknown` (heuristic + per-source default)
- `sourceConfidence`: naukri/foundit/instahyre/hirist=1.0, linkedin=0.95, wellfound/yc=0.85, remote boards 0.6–0.7
- `experienceIntegrity`: cross-check between title and explicit `experience_text`
- Description threshold raised to **150 chars** (was 50). LinkedIn placeholder explicitly detected.

### Ranking (`JobRankingService.server.ts`)
`rankJob(raw, ctx, {sourceConfidence})` — final score multiplied by
`0.85 + 0.15 * sourceConfidence` so India-native sources edge out remote boards at equal relevance.

### Normalization (`JobNormalizationService.server.ts`)
`normalizeJob` runs validation + ranking together. `NormalizedJob` now carries
`qualityStatus`, `qualityScore`, `qualityReasons`, `descriptionSource`,
`sourceConfidence`, `experienceIntegrity`.

`selectTop5` gates:
1. `qualityStatus === "ok"` && `qualityScore >= 60`
2. `!titleMismatch`
3. `matchScore >= 0.5`
4. `freshnessDays <= 30`
5. `locationTier ∈ {same_city, same_state, remote, same_country}`
Never pads.

### Score consistency fix
Root cause of "card 65% vs panel 11%": `getDiscoveredJob` re-ranked with an
empty filter context. Fixed in two places:
- Backend (`jobs.api.ts`): `getDiscoveredJob` overlays the cached `match_score`
  on the re-ranked DTO.
- Frontend (`JobsPage.tsx`): selected job prefers the in-memory `all` list
  (canonical from the original search) over the detail fetch.

### Debug trace (`/api/public/debug/jobs-trace`)
Extended report:
- per-source `raw / valid / ms / error`
- `validationBreakdown`
- per-job `qualityScore`, `qualityReasons`, `descriptionSource`,
  `descriptionLen`, `urlValid`, `experienceIntegrity`
- `removedFromTop5Because` for every shortlisted job
- new funnel stage `afterQualityGate`

## Acceptance
`Front End Developer / Bangalore / Fresher`:
- Top-5 jobs all `qualityStatus=ok` and `qualityScore≥60`
- 0 senior titles, 0 cross-family titles, 0 foreign on-site
- card score == panel score for every job
- every Top-5 url passes `new URL()` http/https check
