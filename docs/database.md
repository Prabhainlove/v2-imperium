# Imperium Database Architecture

Quick reference for every table the Job Discovery Engine and surrounding
workflow rely on.

| Table | Purpose | Created By | Used By | Retention |
|---|---|---|---|---|
| `profiles` | Single source of truth for the user (skills, experience, education, links). | Onboarding / Resume Import / LinkedIn Import | Profile page, Jobs ranking, Resume Studio | Permanent |
| `job_listings` | Cache of jobs returned by the Discovery Engine. `status='discovered'` rows are ephemeral; rows attached to applications stay. | `JobCacheService.cacheDiscovered` | Jobs page, Resume Studio handoff | 24h sweep + replaced on new search (only `status='discovered'`) |
| `selected_jobs` | The one job the user picked to take into Resume Studio. | `JobSelectionService.selectJob` (Apply / Generate Resume button) | Resume Studio loader | Replaced on next selection |
| `search_history` | Lightweight log of past searches (query, filters, result count). | `SearchHistoryService.logSearch` | Future analytics / recent-searches UI | Permanent (metadata only) |
| `applications` | Permanent record of every application package (resume, cover letter, status). | Resume Studio approve → Application Engine | Application Tracker | Permanent |
| `application_timeline` | Audit trail of status changes per application. | Application Engine, Tracker | Tracker timeline view | Permanent |
| `activity_log` | Live agent activity stream (search, score, generate, submit). | Every agent step | Activity / Autopilot pages | Permanent (can be pruned) |

## Service ↔ Table map

```text
JobRetrievalService       → (none — pure HTTP)
JobNormalizationService   → (none — pure transform)
JobRankingService         → (none — pure function)
CompanyInfoService        → (none — derives URLs)
JobCacheService           → job_listings
JobSelectionService       → selected_jobs
SearchHistoryService      → search_history
ApplicationEngineService  → applications, application_timeline
ApplicationTrackerService → applications, application_timeline
```

## Lifecycle: Discovery → Resume Studio

```text
search → JobRetrievalService
       → JobNormalizationService + JobRankingService
       → JobCacheService.cacheDiscovered (job_listings, status=discovered)
       → SearchHistoryService.logSearch  (search_history)
click Apply
       → JobSelectionService.selectJob   (selected_jobs)
       → navigate('/resume?jobId=...')
Resume Studio
       → reads selected_jobs + job_listings
       → on approve → ApplicationEngine writes `applications`
```

## Retention rules

- `job_listings` rows with `status='discovered'` are deleted on every new
  search for the same user, and swept after 24h.
- `selected_jobs` keeps only the most recent row per user.
- `search_history` is append-only; safe to prune older than 90 days later.
- `applications` / `application_timeline` are never auto-deleted.
