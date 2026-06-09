# Job Discovery Engine — Final Implementation Plan (Approved)

All adjustments incorporated. Ready to build the moment you switch to build mode.

## Architecture summary

- **Flow** — Profile → Discovery → Rank → Top 5 → Select → Resume Studio. No bulk resume gen, no auto-apply.
- **AI** — Stays routed through `ModelRouter`; deterministic ranking heuristic works without any cloud key, so Ollama+Qwen3 is a config swap later.
- **Existing files preserved** — `JobSources.server.ts`, `JobDescriptionAnalyzer.server.ts`, `ProfileAnalyzer.server.ts`, `ModelRouter.server.ts`, `JobPipeline.server.ts` are untouched. New services wrap them.

## Database (1 migration)

`supabase/migrations/…_selected_jobs_and_search_history.sql`
- `selected_jobs(id, user_id, job_id → job_listings, selected_at)` — Resume Studio handoff
- `search_history(id, user_id, query, filters jsonb, result_count, created_at)` — metadata only
- Both: RLS enabled, owner-only policies, `authenticated` + `service_role` grants

Existing `job_listings.status='discovered'` continues to serve as the 24h job cache (cleared per user on each new search + 24h sweep).

## Backend services (7 new files, single responsibility each)

```
src/backend/jobs/
├── JobRetrievalService.server.ts      // fans out to SOURCES; returns RawJob[] + per-source status
├── JobNormalizationService.server.ts  // RawJob → NormalizedJob DTO
├── JobRankingService.server.ts        // match score + 5-axis breakdown + Intelligence label
├── CompanyInfoService.server.ts       // logo via Clearbit, graceful fallback (no banner dependency)
├── JobCacheService.server.ts          // job_listings cache: write/read/clear/24h sweep
├── JobSelectionService.server.ts      // selected_jobs writes
└── SearchHistoryService.server.ts     // search_history append (query + filters + count only)
```

**Job Intelligence label** (replaces Resume Readiness on this page):
`>=0.80 High Opportunity · >=0.60 Strong Match · >=0.40 Competitive · else Long Shot`

## API (1 new file)

`src/backend/api/jobs.api.ts` — 4 TanStack server functions, all auth-protected:
- `discoverJobs(filters)` → `{ top5, all, perSource, cachedAt }`
- `getDiscoveredJob(jobId)` → full `NormalizedJob`
- `selectJobForResume(jobId)` → `{ redirect: '/resume?jobId=…' }`
- `getProfileMetrics()` → `{ profileStrength, atsReadiness, resumeQuality, applicationsSubmitted, interviewSuccessRate }`

Existing `runJobSearch` / `getJobs` left intact for other pages.

## Frontend (10 files)

```
src/frontend/jobs/
├── JobsPage.tsx                       // composes layout
├── jobs.logic.ts                      // useDiscovery, useJobDetails, useSelectJob, useProfileMetrics
├── jobs.css                           // scoped .jobs- styles matching reference
└── components/
    ├── ProfileMetricsRail.tsx         // 5 live metrics
    ├── JobSearchBar.tsx               // 6 fields + Search/Refresh
    ├── TopMatchesRow.tsx              // Top 5 cards
    ├── SelectedJobSummary.tsx         // title + meta + 5-bar breakdown + key skills
    ├── JobIntelPanel.tsx              // right rail: logo, CTAs, JD overview, source
    ├── AllJobsGrid.tsx                // bottom grid + sort
    └── JobCard.tsx                    // shared card (view/apply)
```

## Documentation (1 file)

`docs/database.md` — table-by-table reference (Purpose / Created By / Used By / Retention) for `profiles`, `job_listings`, `selected_jobs`, `search_history`, `applications`, `application_timeline`, `activity_log`, plus the service↔table map and discovery→studio lifecycle.

## What does NOT happen on /jobs

- ❌ Resume generation
- ❌ Application records
- ❌ Cover letter generation
- ❌ Auto-submit

Apply / Generate Resume only writes `selected_jobs` and navigates to `/resume?jobId=…`.

## Acceptance (all covered)

✓ Search · ✓ Rank · ✓ Top 5 · ✓ Match Scores · ✓ Job Intelligence · ✓ Full Details · ✓ All Jobs Grid · ✓ Cache + 24h TTL · ✓ Cache replaced on new search · ✓ Job selection · ✓ Resume Studio navigation · ✓ No resume gen on Jobs · ✓ No application creation on Jobs
