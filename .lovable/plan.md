# Job Discovery Pipeline Diagnostics

## Goal

Answer your debug request with hard numbers by instrumenting the existing pipeline (no logic changes yet), running your exact search (`Front End` / `Hyderabad` / `Fresher`), and producing a stage-by-stage funnel.

I cannot get those numbers without code — the current pipeline only returns the *final* `top5` + `all`, and silently drops jobs at four hidden stages (`matchesQuery` source-side, experience hard filter, salary hard filter, mode hard filter, then `selectTop5` threshold).

## What I'll Add (diagnostics only, no ranking changes)

### 1. `JobRetrievalService.server.ts`
- Keep `RetrievalResult` as-is. Add an internal `rawCounts` map: for each source, count jobs **before** `matchesQuery` filtering, so we see "LinkedIn returned 25, kept 3 after role/location match".
- Each source adapter currently filters with `matchesQuery` inline. Add a `prefilterCount` returned via a new `SourceTrace` shape:
  ```ts
  { id, label, status, fetched, kept, error? }
  ```

### 2. `src/backend/api/jobs.api.ts` — `discoverJobs` handler
Add a `trace` object to the response (only populated when `?debug=1` or always, small cost):
```ts
trace: {
  perSource: SourceTrace[],          // fetched vs kept per source
  afterRetrieval: number,            // unique raws
  afterNormalize: number,
  afterExperienceFilter: number,
  afterSalaryFilter: number,
  afterModeFilter: number,
  afterTitleFamilyGate: number,      // jobs with titleMismatch=false
  afterScoreThreshold: number,       // matchScore >= 0.45
  top5Count: number,
  sampleRaw: Array<{title, location, experienceBucket, source}>,    // first 20 after retrieval
  sampleFiltered: Array<{title, score, reasons:{title,skills,exp,loc,fresh,sal}, survived:boolean}>, // first 20 after filtering
}
```
- Compute `experienceBucket` for `sampleRaw` by calling `classifyExperience(title, description)` (already exported from ranking service).
- For `sampleFiltered`, capture the breakdown returned by `rankJob` and explain in one line why it survived (e.g., "title=1.0, exp match, loc=same_city").

### 3. Frontend — no UI changes required for the report
I'll call the server function directly via `stack_modern--invoke-server-function` with your search payload, log in, and read the `trace` field.

### 4. New temporary route `/api/public/debug/jobs-trace` (optional)
A POST endpoint that takes `{title, location, experience}` and runs the same pipeline using `supabaseAdmin` against a system profile (no auth), returning only the `trace`. Lets us reproduce the exact funnel without going through the UI.

Guarded by `process.env.DEBUG_JOBS_TRACE === "1"` so it can't be left open.

## Execution Steps After Implementation

1. Run `Title: Front End` / `Location: Hyderabad` / `Experience: Fresher`.
2. Report:
   - **Per-source**: LinkedIn / Naukri / Foundit / Wellfound / RemoteOK / YC fetched vs kept (Foundit, Wellfound, YC are not currently wired — I'll list them as `skipped: not_implemented` so you see that gap explicitly).
   - Funnel counts at every stage.
   - First 20 raw jobs (title, location, experienceBucket, source).
   - First 20 post-filter jobs (title, final score, one-line "why it survived").
3. Identify the **exact stage** that drops Hyderabad frontend fresher jobs.

## Files Touched (diagnostics only)
```
edit  src/backend/jobs/JobRetrievalService.server.ts   (+ SourceTrace shape, fetched/kept counters)
edit  src/backend/jobs/JobSources.server.ts            (each adapter returns {fetched, kept} via a wrapper)
edit  src/backend/api/jobs.api.ts                      (+ trace object on discoverJobs response)
new   src/routes/api/public/debug.jobs-trace.ts        (gated public trace endpoint)
```

No ranking, no UI, no DB schema changes. After the funnel is reported and the stage is identified, I'll come back with a separate fix plan for whichever stage is broken (most likely `matchesQuery` in `fetchLinkedIn` requiring location substring AND title to both hit, or `classifyExperience` mislabeling "Front End Developer" without seniority cues as `3-5` instead of `fresher`).

## Out of Scope (this plan)
- Fixing the bug itself.
- Adding Foundit / Wellfound / YC Jobs adapters (will note as missing in the report).
- Resume Studio.

Approve and I'll implement, run the search, and post the funnel back here.