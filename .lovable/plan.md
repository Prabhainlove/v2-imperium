# Job Discovery Engine — Ranking & Filter Fixes

Scope: tighten ranking + filtering so Top 5 reflects real best matches. No DB migration changes. No Resume Studio work yet.

## Files Touched

1. `src/backend/jobs/JobRankingService.server.ts` — rewrite scoring (title relevance, experience buckets, freshness, location tiers, salary penalty).
2. `src/backend/jobs/JobNormalizationService.server.ts` — expose `experienceBucket`, `freshnessDays`, `isNewToday`, `locationTier` on `NormalizedJob`.
3. `src/backend/api/jobs.api.ts` — apply hard filters (experience bucket, salary min, work mode) before ranking; pass `workMode` + experience bucket into ranking context.
4. `src/frontend/jobs/components/JobSearchBar.tsx` — replace experience options with `Fresher / 0–2 / 3–5 / 5+`.
5. `src/frontend/jobs/jobs.logic.ts` — type the new experience bucket value; pass through.
6. `src/frontend/jobs/components/JobCard.tsx` + `TopMatchesRow.tsx` — render 🔥 New Today badge, ensure logo fallback to company-initials avatar (never blank).
7. `src/frontend/jobs/jobs.css` — styles for new badge + initials avatar.

No changes to: migrations, `selected_jobs`, `search_history`, RLS, `JobSources.server.ts`, Resume Studio.

## Technical Detail

### 1. Experience Buckets
Enum `ExperienceBucket = "fresher" | "0-2" | "3-5" | "5+"`.

Classifier `classifyExperience(title, description)`:
- Regex on title first (highest signal):
  - `/intern|graduate|fresher|trainee|entry[- ]level|junior|jr\.?\b/i` → `fresher`
  - `/associate|jr engineer/i` or yrs match `1|2` → `0-2`
  - `/mid|mid[- ]level/i` or yrs `3|4|5` → `3-5`
  - `/senior|sr\.?\b|lead|principal|staff|architect|manager|head of|director|vp\b/i` → `5+`
- Then description: pull `(\d+)\+?\s*(?:years|yrs)` min value → bucket by range.
- Default: `3-5` (neutral) when no signal.

Hard filter: if user selects a bucket, drop jobs not in that bucket BEFORE ranking. "Any" keeps all.

### 2. Title Relevance (heavier weight)
- Build query tokens from `filters.title` (e.g. "front end" → `["front","end","frontend"]`, normalize "front end"/"front-end"/"frontend" → canonical `frontend`).
- Maintain role-family synonym map:
  - frontend: `frontend, front-end, react, angular, vue, ui engineer, web developer, javascript engineer`
  - backend: `backend, back-end, api, node, golang, python engineer, java engineer`
  - fullstack, mobile, ios, android, data, ml, devops, design, pm, marketing, sales…
- `titleScore`:
  - 1.0 if job title contains canonical family token or strong synonym
  - 0.6 partial token overlap
  - 0.0 if title belongs to a different identified family → also flagged as `titleMismatch=true` (used as penalty)
- Apply penalty: if `titleMismatch`, multiply final score by 0.4 so unrelated roles can't reach Top 5.

### 3. Freshness
- `freshnessDays = floor((now - postedAt)/day)`; missing → treat as 7.
- `freshnessScore`:
  - 0 days: 1.0
  - 1: 0.95
  - 2–3: 0.85
  - 4–7: 0.7
  - 8–14: 0.5
  - 15–30: 0.3
  - >30: 0.1
- `isNewToday = freshnessDays <= 1`.

### 4. Location Tiers
Inputs: user city/state/country (parse from `filters.location`, e.g. "Hyderabad"). Use small India city→state map + country guess (default IN for known IN cities), plus `Remote`.
Tiers:
- same_city → 1.0
- same_state → 0.85
- remote → 0.75
- same_country → 0.55
- other → 0.2
If user typed `remote`/blank: remote=1.0, others 0.6.

### 5. Salary
- If `salaryMin` provided and `job.salary_min` known and `< userMin` → `salaryScore = 0.2` and mark `belowSalary=true`.
- If unknown → 0.6 (neutral).
- If meets/exceeds → 1.0.
- Hard exclude only when user provides salaryMin AND job has explicit salary_max below userMin.

### 6. Final Score
```
base = 0.30*title + 0.25*skills + 0.15*experienceFit + 0.12*location + 0.10*freshness + 0.08*salary
score = base * (titleMismatch ? 0.4 : 1) * (experienceBucketMismatch ? 0.5 : 1)
```
`experienceFit`: 1.0 if classified bucket == requested bucket, 0.6 adjacent, 0.3 far.

### 7. Top 5 Selection
- Sort by score desc.
- Tie-breaker chain: freshness desc → title exact match → skills matched count → salary known desc.
- Enforce: Top 5 must each have score ≥ 0.45 AND no `titleMismatch`. If fewer than 5 qualify, show what qualifies (don't pad with junk).

### 8. Company Logo Fallback
- `JobCard`/`TopMatchesRow`: `<img onError>` swaps to initials avatar div (already have `companyInitials` helper). Render initials avatar by default when `companyLogo` empty.
- Add deterministic background color from hash(company) for visual variety.

### 9. New Today Badge
- Show `🔥 New Today` pill on card when `isNewToday`.

### 10. UI Filter Options
JobSearchBar experience `<select>`:
```
Any Experience | Fresher | 0–2 Years | 3–5 Years | 5+ Years
```
Value sent to backend: `""|"fresher"|"0-2"|"3-5"|"5+"`.

## Out of Scope
- Migration edits, Resume Studio, new job sources, Ollama switch, screenshots (will follow after build).

## After Implementation
Will share screenshots of Top 5 + a short note explaining the score formula above, before moving to Resume Studio.