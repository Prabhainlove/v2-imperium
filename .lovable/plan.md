## Imperium Production Upgrade Plan

A large, multi-area upgrade. I'll work in clearly separated phases so each part is testable before moving on.

### Phase 1 — Expanded job sources
- Add three new adapters in `sources.server.ts`:
  - **LinkedIn**: use the public JSON jobs guest endpoint (`linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/...`) since no public Jobs API key exists for individual devs. Mark availability as "scraping-fallback" and flag clearly if it fails.
  - **Indeed**: no public API; use **Adzuna API** (legit aggregator that includes Indeed-class listings) when `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` secrets are present, otherwise mark `unavailable` (no faking).
  - **Naukri**: no public API; attempt their public `nlogin` JSON search endpoint, otherwise mark `unavailable`.
- Update `REAL_SOURCES` config with `requiresKey` flag and per-source availability state.
- Surface per-source counts + availability badges in `SourceMonitor`.

### Phase 2 — RenderCV-style resume
- New `src/lib/imperium/rendercv.ts`: markdown → structured resume JSON → HTML template (clean, ATS-friendly typography). Three template variants: `classic`, `modern`, `compact`.
- New server fn `generateRenderCvResume` returns `{ original_md, optimized_md, rendered_html, ats: { score, added_keywords, missing_keywords, improvements } }`.
- New route `/resume` upgrade: side-by-side panes (Original → Optimized → Rendered preview), template picker, ATS score card, Export PDF (browser `window.print` to PDF) + Export Markdown.

### Phase 3 — Auto workflow switching
- New `useWorkflowAutopilot` hook subscribes to `activity_log` for the active `task_id` and `navigate()`s automatically on stage completion: search → resume → application-prep → review.
- Each route opts in via the hook; user sees a small "Auto-advancing…" toast with cancel.

### Phase 4 — Application review gate
- Add `status='Pending Review'` and `requires_approval` flow.
- New `/applications/$id/review` route shows Company, Job, Resume, Cover Letter, fields, big READY TO APPLY banner, **Approve** / **Skip** buttons.
- Pipeline now stops at `Pending Review`; submission only happens after approval server fn.

### Phase 5 — Live application filling visibility
- Simulated browser-fill animation panel showing steps: Opening → Reading Form → Filling Name → Email → Phone → Uploading Resume → Cover Letter → Review Complete.
- Backed by activity_log entries written by `submitApplication` server fn (with realistic delays). Since we cannot actually post to LinkedIn/Indeed forms, this is a transparent "Application package prepared & marked submitted" — clearly labeled.

### Phase 6 — Match improvements
- Extend scorer to compute: `salary_match`, `experience_match`, `location_match`, persist to `job_listings` (new columns via migration).
- Jobs table shows Match %, Missing Skills chips, Salary, Experience badge, Location badge. Default sort = overall score.

### Phase 7 — Unified execution timeline
- New `<ExecutionTimeline />` on dashboard: vertical stages with status icons + timestamps streamed from activity_log:
  Search Started → Jobs Retrieved → Jobs Ranked → Resume Generated → Cover Letter Generated → Application Prepared → User Review → Submitted.

### Technical notes
- DB migration: add `salary_match`, `experience_match`, `location_match` numeric cols on `job_listings`; add `requires_approval` bool + `submitted_at` ts on `applications`.
- Secrets: request `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` only when user opts into Indeed/Adzuna. LinkedIn/Naukri attempts run keyless.
- No fake data anywhere — sources that fail show clear "unavailable" state.
- All new logs flow through existing `activity_log` so timeline, autopilot, and source monitor share one source of truth.

### Out of scope
- Real LinkedIn/Indeed/Naukri OAuth submission (their ToS forbids automation without partner agreements). The review-gate + simulated-fill is explicitly framed as "package prepared, marked submitted" rather than faking actual posts.

I'll wait for your approval before touching code.
