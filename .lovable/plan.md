
## Why a migration is required (not optional)

The existing FastAPI backend (`IMPERIUM/main.py` + Python services) cannot execute in this environment:

- The Lovable preview runs on a Cloudflare Worker SSR runtime. There is no Python process, no `uvicorn`, no persistent SQLite, no inbound port from the browser to a sandbox process.
- The frontend has been polling `http://localhost:8000/*` for the entire session — every request fails with `Failed to fetch` (see network log).
- "Fix backend execution failures" inside Lovable is therefore impossible without moving the runtime.

So the minimum viable change is: **keep the UI as-is, port only the Job Agent pipeline to server functions, persist in Lovable Cloud, hit real public job APIs.** No other Imperium agent is touched.

## Scope (only what the demo needs)

In scope:
1. Job discovery from real public APIs (RemoteOK, Remotive, Arbeitnow — no keys).
2. Match scoring (skills + role + location + remote heuristic).
3. Resume + cover letter generation via Lovable AI Gateway (`google/gemini-2.5-flash`).
4. Application package creation + lifecycle tracking.
5. Real-time activity log written at every pipeline step.
6. Dashboard metrics, jobs list, applications list, activity feed, profile.

Out of scope (per user instruction — no fake data, no extra agents):
- Coding agent, research agent, automation agent, workflow agent, evolution engine.
- ATS auto-submission to real job boards (still rendered as "prepared" packages).
- Python backend code — left untouched on disk.

## Technical changes

**Lovable Cloud schema** (mirrors `schema.sql` essentials only):
```
candidate_profiles (id, name, contact, skills, experience, summary, updated_at)
job_listings        (id, source, external_id UNIQUE, title, company, location,
                     url, description, tech_stack, salary_min/max, match_score,
                     status, discovered_at)
applications        (id, listing_id FK, status, match_score, resume_md,
                     cover_letter_md, applied_at, updated_at, notes)
activity_log        (id, task_id, agent, action, status, detail, created_at)
```
RLS: open read+write for `anon` (single-user demo, no auth wired). GRANTs applied per public-schema rule.

**Server functions** (`src/lib/imperium/*.functions.ts`):
- `runJobSearch` — orchestrates the 8-stage pipeline, writes activity per stage, returns `{ task_id, stats }`.
- `getDashboard`, `getJobs`, `getApplications`, `getActivity`, `getHealth`, `getAgents`, `getProfile`, `saveProfile`.
- `generateArtifact` — returns resume/cover-letter markdown for a given application.

Discovery adapters live in `src/lib/imperium/sources/*.ts` (one per source). Each returns a normalized `JobListing[]`. Scoring + LLM calls in `src/lib/imperium/pipeline.ts`.

**Frontend client** (`src/lib/imperium/client.ts`):
- Replace `fetch(apiUrl(...))` with `useServerFn` wrappers.
- Drop the `API_BASE_URL` Settings field (or repurpose it as a no-op note explaining the in-app runtime).
- Keep every existing route/component untouched — they consume the same shapes.

**Activity transparency** (the demo's headline requirement):
The pipeline emits these activity rows in order, with timestamps, so the existing Activity feed + source monitor + progress tracker animate naturally:
```
plan → discover(remoteok) → discover(remotive) → discover(arbeitnow)
  → deduplicate → score → shortlist → generate_resume(job) ×N
  → generate_cover_letter(job) ×N → prepare_application(job) ×N → done
```

## Validation

After implementing, I will:
1. Invoke `runJobSearch` with `role="AI Engineer"`, `location="Remote"` via `stack_modern--invoke-server-function` (calling a thin `/api/public/run-search` route that wraps the server fn for testing).
2. Confirm rows land in `job_listings`, `applications`, `activity_log`.
3. Open `/search` in the preview and watch the pipeline animate end-to-end.
4. Verify `/jobs`, `/applications`, `/activity`, `/` all render real data.

The Python backend files stay on disk untouched for reference but are no longer the runtime.

## What I need from you

Confirm: **proceed with this migration?** It's the only way to get a working demo inside Lovable. If you'd rather keep the Python backend authoritative, the alternative is for you to run `python main.py` locally + ngrok and paste the URL in Settings — I cannot run that process here.
