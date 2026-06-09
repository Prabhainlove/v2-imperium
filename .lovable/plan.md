# Job Discovery — Data Quality & Retrieval Recovery

Scope: retrieval, normalization, validation, ranking consistency, debug. No Resume Studio, no UI redesign, no DB changes.

## 1. RawJob contract (`JobSources.server.ts`)

Standardize every adapter to return:

```
source, sourceJobId, title, company, location,
description?, experienceText?, postedAt?, salary?, url, companyLogo?
```

Update adapters where fields are dropped today (LinkedIn guest cards, Foundit, Wellfound, YC, Naukri HTML fallback). Carry `experienceText` consistently into normalization.

## 2. Extraction priority (per adapter)

Order: **JSON-LD `JobPosting` → OpenGraph/meta → DOM selectors → fallback parse.**

- LinkedIn: when card lacks description, fetch the public job permalink and parse `<script type="application/ld+json">` for `description`, `datePosted`, `hiringOrganization.name`, `jobLocation`.
- Naukri/Foundit/Wellfound/Hirist/Instahyre: same JSON-LD probe before falling back to DOM.
- YC: already JSON-LD; keep.
- Each adapter must populate `description` when available (≥50 chars).

## 3. Validation pipeline (new `JobValidationService.server.ts`)

After source fetch, before ranking:

```
qualityStatus: "ok" | "incomplete" | "invalid_url" | "missing_description"
qualityScore : 0–100
qualityReasons: string[]
```

Rules:

- Required: title, company, location, url. Missing → `incomplete`.
- URL format check (`new URL()`, http/https). Bad → `invalid_url`.
- Description < 50 chars → `missing_description`.
- `qualityScore` = description completeness (40) + url validity (20) + company metadata (15) + location specificity (10) + source reliability (15).
- Optional **HEAD probe** for URL liveness, gated by env flag (`JOBS_URL_PROBE=1`), 1.5s timeout, parallel with limit 8, cached by URL. Default OFF in preview to keep latency low; ON in debug trace.

Only `qualityStatus === "ok"` jobs are eligible for Top 5. Others may still appear in All Jobs with a "Limited info" badge (already supported via existing fields — no UI change required if we surface via `intelligence`).

## 4. Single ranking source (score consistency)

Root cause of 65% vs 11%: card uses pre-normalization score, panel re-ranks with different context. Fix:

- `rankJob()` runs **once** inside `normalizeJob()`.
- `NormalizedJob.matchScore` is the only score consumed by JobCard, TopMatchesRow, AllJobsGrid, SelectedJobSummary, JobIntelPanel.
- Remove any client-side re-computation. Audit `src/frontend/jobs/**` for second score paths and delete.

## 5. Experience classification

Already returns `null` for unknown — verify API hard-filter keeps `null`. Add unit-style sanity in debug trace: count of jobs with `experienceBucket === null` kept vs dropped.

## 6. Location & role family

Already implemented (tiers + family gate). Reconfirm: Bangalore search → `same_city` for `bengaluru|bangalore`; foreign on-site penalized; non-frontend families excluded from Top 5.

## 7. Source reliability weighting

Add `sourceWeight` map:

```
naukri:1.0, foundit:1.0, instahyre:1.0, hirist:1.0, linkedin:0.95,
wellfound:0.85, yc:0.85,
remoteok:0.7, remotive:0.7, arbeitnow:0.6
```

Multiply final `matchScore` by `0.85 + 0.15*sourceWeight` so India-native sources edge out remote boards at equal relevance. Feeds into `qualityScore` too.

## 8. Top-5 gate (update `selectTop5`)

Require additionally:

- `qualityStatus === "ok"`
- `qualityScore >= 60`
Existing gates (no title mismatch, score ≥ 0.5, freshness ≤ 30d, allowed tier) preserved. Never pad.

## 9. Debug trace (`/api/public/debug/jobs-trace`)

Extend report with:

- per-source raw/validated/kept counts
- validation failure breakdown (`incomplete`, `invalid_url`, `missing_description`)
- per-job `qualityScore`, `qualityReasons`
- final `matchScore` shown is identical to UI
- removal stage for every job

## 10. Files touched

- `src/backend/jobs/JobSources.server.ts` — adapter normalization + JSON-LD probes
- `src/backend/jobs/JobValidationService.server.ts` — **new**
- `src/backend/jobs/JobRankingService.server.ts` — source weight in final score
- `src/backend/jobs/JobNormalizationService.server.ts` — embed validation, single-score guarantee, stricter `selectTop5`
- `src/backend/api/jobs.api.ts` — run validator before rank, expose `qualityScore`/`qualityStatus`
- `src/routes/api/public/debug.jobs-trace.ts` — extended trace
- `.lovable/plan.md`
- Frontend: audit JobCard / SelectedJobSummary / JobIntelPanel / TopMatchesRow only to confirm they read `job.matchScore` (no logic edits unless duplicate scoring found)

## 11. Acceptance

Run debug trace for `Front End Developer / Bangalore / Fresher`:

- ≥5 jobs in Top 5, all `qualityStatus=ok`, `qualityScore≥60`
- 0 senior titles, 0 cross-family titles, 0 foreign on-site
- card score == panel score for every job
- every Top-5 URL parses as valid http(s); when `JOBS_URL_PROBE=1`, all return <400

Out of scope: Resume Studio, Application Engine, Tracker, DB schema, auth, Ollama, UI redesign.

1. Description threshold = 150 chars

2. Add sourceConfidence

3. Add experienceIntegrityCheck

4. Add descriptionSource to debug trace. most important focus Data Quality.