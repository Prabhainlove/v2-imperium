# Imperium V2 — Auth Migration Impact Report (Phase 3 Pre-Flight)

Status: **Analysis only — no code changes proposed in this document.**
Scope: Replace `mockAuth` (localStorage SHA-256 store) with Supabase Auth and
elevate the `profiles` table to the single source of truth.

---

## 0. Executive Summary

The backend is already **half-migrated**: every server function in
`src/backend/api/imperium.api.ts` (~45 endpoints) already calls
`requireSupabaseAuth` and reads/writes a Supabase `profiles` table. The
frontend, however, still authenticates with `mockAuth.ts` (localStorage),
which never produces a Supabase JWT. **In current state any authenticated
server fn called from the UI returns 401** — the system only appears to work
because most UI surfaces read from local Zustand/localStorage stores
(`useResumeStore`, `useApplicationsStore`, `profile.data.ts` seeded from
`InternalSeedProfile`), not from the server.

Phase 3 therefore is not "introduce auth" — it is "**wire the existing
backend to a real auth client and delete the local fakes**". Surface area is
small (≈8 frontend files) but blast radius is high (every page reads from
local stores today).

Local-first compatibility: **preserved**. Supabase Auth runs against the
existing Cloud project; Ollama, PDF, DOCX, job discovery all remain
client-side. No new mandatory cloud dependency.

---

## 1. Auth Dependency Audit

### 1a. `mockAuth` / localStorage session

| # | File | Function / symbol | Current behavior | Proposed replacement | Risk |
|---|---|---|---|---|---|
| 1 | `src/frontend/auth/mockAuth.ts` | entire module | SHA-256 user store + session in `localStorage` keys `imperium.users` / `imperium.session` | Delete file. | High (many callers) |
| 2 | `src/frontend/auth/SignInPage.tsx` | `signIn`, `ensureDemoUser` | Reads/writes localStorage users | `supabase.auth.signInWithPassword` + Google OAuth via Lovable broker | High |
| 3 | `src/frontend/auth/SignUpPage.tsx` | `signUp` | Creates localStorage user | `supabase.auth.signUp({ email, password, options: { emailRedirectTo } })` | High |
| 4 | `src/routes/_authenticated/route.tsx` | `beforeLoad` gate | Synchronous `getSession()` from localStorage; redirects to `/auth` | Switch to integration-managed `ssr:false` gate calling `supabase.auth.getUser()` (see `tanstack-supabase-integration`) | High |
| 5 | `src/frontend/settings/SettingsPage.tsx` | `useSession`, `signOut` | Reads mock session, clears localStorage | `supabase.auth.getUser()` via hook + `supabase.auth.signOut()` then `queryClient.clear()` + `navigate('/auth', { replace: true })` | Medium |
| 6 | `src/frontend/dashboard/components/TopBar.tsx` | `signOut` | localStorage clear | Same as #5 | Low |
| 7 | `src/frontend/dashboard/dashboard.data.ts` | `useSession()` | Reads name/email for hero | Replace with `useUser()` hook backed by `supabase.auth.getUser()` + `getMyProfile` server fn | Medium |
| 8 | `src/frontend/profile/profile.data.ts` | `useSession()` + `getInternalSeedProfile()` | Hydrates page from seed in dev, session name/email overlay | Pull via `getProfile` server fn (already exists in `imperium.api.ts:77`), drop seed except behind dev guard | High |

### 1b. `SAMPLE_PROFILE` / `InternalSeedProfile`

| # | File | Use | Risk after Phase 3 |
|---|---|---|---|
| 1 | `src/backend/profile/InternalSeedProfile.ts` | Dev-only seed (already gated by `NODE_ENV`) | Keep as-is; used only by tests + dev fallback |
| 2 | `src/backend/resume/ResumeGenerator.ts:12` | `getSeedOrEmpty()` fallback when caller passes no profile | Medium — caller should always pass real profile; keep `EMPTY_PROFILE` fallback only |
| 3 | `src/frontend/resume/state/useResumeStore.ts:15,103` | `INITIAL = seedFromProfile(getInternalSeedProfile() ?? EMPTY_PROFILE)` — seeds first-render resume | High — must seed from `getMyProfile()` result instead. Today this is why the resume page "shows Dinesh" |
| 4 | `src/frontend/profile/profile.data.ts:9,34` | `SEED` const at module scope | High — replace with server-fed profile |

### 1c. Hardcoded identity / anonymous access

| # | File | Issue | Severity |
|---|---|---|---|
| 1 | `src/frontend/resume/state/useResumeStore.ts:114` | `selectedJob` default hardcoded "Imperium Labs" in dev — survives across users via persisted store key | Medium |
| 2 | `src/frontend/applications/state/repository.ts` | Global `APP_KEY` / `EVT_KEY` localStorage — no user scoping, so two users on the same browser see each other's applications | High |
| 3 | `src/frontend/applications/state/useApplicationsStore.ts` | Same — Zustand-on-localStorage with no userId in key | High |
| 4 | `src/frontend/resume/ai/AiCache.ts` | Global cache key, no userId scoping | Low (cache only) |
| 5 | `src/backend/api/imperium.api.ts::getNotifications` (line 417) | NOT protected by `requireSupabaseAuth`; returns hardcoded list | Medium |
| 6 | `src/backend/api/imperium.api.ts::getHealth`, `getAgents` | Public — acceptable | Low |
| 7 | `src/backend/api/jobs.api.ts` (all 4 fns: `discoverJobs`, `getDiscoveredJob`, `selectJobForResume`, `getProfileMetrics`) | NOT protected — accept anonymous calls and use process-global cache | High |
| 8 | `src/backend/database/AuthAttacher.ts` | Reads `supabase.auth.getSession()` → empty under mockAuth → every protected call 401s | High (blocking) |

### 1d. Fake ownership assumptions

| # | Server fn | Issue |
|---|---|---|
| 1 | `imperium.api.ts::getApplication` (341) | Filters by `userId` via `.eq("user_id", userId)` — **OK** (RLS-safe) once RLS exists |
| 2 | `imperium.api.ts::getArtifact` (521) | Looks up artifact, then loads `profiles` row for the same `userId` — relies on artifact already being scoped. **Need to verify** artifact table has `user_id` and `.eq("user_id", userId)` filter is applied |
| 3 | `imperium.api.ts::renderApplicationResume` (559) | Same pattern — must filter application+resume by userId before render |
| 4 | `imperium.api.ts::saveProfile` (159) | Accepts client-supplied profile fields; trusts `userId` from middleware — **OK** but should reject `id` field if present in payload |
| 5 | `imperium.api.ts::attachLocalAgentRun` (1056) | Must verify `applicationId` belongs to caller |
| 6 | `imperium.api.ts::updateApplicationStatus` / `updateApplicationFields` | Must filter by user_id, not just application id |

---

## 2. Identity Flow Map

```text
                  ┌──────────────────────────────────┐
                  │  supabase.auth (target)           │
                  │  -- today: mockAuth localStorage  │
                  └──────────────┬───────────────────┘
                                 │ session.user.id (JWT.sub)
                                 ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │ Frontend identity readers (today)                                │
  │   useSession()  ──────►  SettingsPage, TopBar, dashboard.data,   │
  │                          profile.data                            │
  │   getSession()  ──────►  _authenticated/route.tsx (gate)         │
  └──────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │ Bearer attach (today BROKEN)                                     │
  │   AuthAttacher.ts → supabase.auth.getSession() → null            │
  └──────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │ Server fns (requireSupabaseAuth)  — already wired                │
  │                                                                  │
  │ PROFILE                                                          │
  │   getProfile, saveProfile, importProfileFromText/Linkedin/Pdf,   │
  │   refreshGithubIntel, getProfileIntelligence                     │
  │                                                                  │
  │ JOBS (NOT yet protected — Phase 3 fix)                           │
  │   discoverJobs, getDiscoveredJob, selectJobForResume,            │
  │   getProfileMetrics, getJobs, runJobSearch                       │
  │                                                                  │
  │ RESUME                                                           │
  │   optimizeMasterResume, renderApplicationResume, getArtifact     │
  │                                                                  │
  │ APPLICATIONS                                                     │
  │   getApplications, getApplication, approveApplication,           │
  │   skipApplicationFn, updateApplicationStatus,                    │
  │   updateApplicationFields, attachLocalAgentRun,                  │
  │   getApplicationTimeline, evaluateApplication, analyzeJobListing │
  │                                                                  │
  │ DASHBOARD / ACTIVITY                                             │
  │   getDashboard, getActivity, getNotifications (unprotected),     │
  │   getCareerIntelligence                                          │
  │                                                                  │
  │ AUX                                                              │
  │   saveJobListing, unsaveJobListing, getSavedJobs,                │
  │   upsertInterview, getInterviews, deleteInterview, getSkillGap   │
  └──────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │ Local-only stores (today the de facto source of truth)           │
  │   useResumeStore   (persist key: imperium-resume-studio-v1)      │
  │   useApplicationsStore (LocalApplicationRepository)              │
  │   AiCache          (resume-ai cache)                             │
  │   profile.data.ts  (SEED const)                                  │
  └──────────────────────────────────────────────────────────────────┘
```

### Identity lifecycle (target state)

| Stage | Owner | Mechanism |
|---|---|---|
| Created | Supabase Auth | `signUp` / OAuth callback |
| Persisted | Browser | `supabase.auth` localStorage (managed) |
| Hydrated | `__root.tsx` | `supabase.auth.onAuthStateChange` (single listener) |
| Read (client) | `useUser()` hook | `supabase.auth.getUser()` |
| Read (server) | `requireSupabaseAuth` | bearer token → `getClaims().sub` |
| Mutated | Auth pages | `signIn/signUp/signOut` |
| Cached | TanStack Query | invalidate on `SIGNED_IN/OUT/USER_UPDATED` only |

---

## 3. Database Schema Proposal (no execution)

Goal: profile is the single source of truth; jobs/applications/resume rows
all key off `auth.users.id`.

### 3a. `public.profiles`  (already exists — confirm columns)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE` | = `auth.uid()` |
| `name` | text | |
| `email` | text | mirrored from auth |
| `phone` | text | |
| `location` | text | |
| `headline` | text | |
| `summary` | text | |
| `target_role` | text | |
| `seniority` | text | |
| `work_mode` | text | |
| `target_locations` | text[] | |
| `salary_expectation` | jsonb | |
| `skills` | text[] | |
| `experience` | jsonb | array |
| `education` | jsonb | array |
| `projects` | jsonb | array |
| `certifications` | jsonb | array |
| `languages` | jsonb | array |
| `achievements` | text[] | |
| `linkedin_url` / `github_url` / `portfolio_url` | text | |
| `github_intel` / `linkedin_intel` / `profile_intel` | jsonb | |
| `selected_job_id` | uuid NULL | denormalized pointer for "active job" |
| `onboarded` | boolean default false | |
| `created_at` / `updated_at` | timestamptz default now() | trigger to bump updated_at |

Indexes: PK only (one row per user). Optional: `(updated_at)` for admin sort.

RLS (all `to authenticated`):
- `select`  `using (id = auth.uid())`
- `insert`  `with check (id = auth.uid())`
- `update`  `using (id = auth.uid()) with check (id = auth.uid())`
- `delete`  none (cascaded by auth)

Trigger: `on auth.users insert → insert into profiles (id, email) values (new.id, new.email)`.

### 3b. `public.applications`

| Column | Type |
|---|---|
| `id` | uuid PK default `gen_random_uuid()` |
| `user_id` | uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE |
| `company` | text NOT NULL |
| `role` | text NOT NULL |
| `job_url` | text |
| `source` | text |
| `status` | text CHECK (status IN ('draft','queued','applied','interview','offer','rejected','withdrawn')) |
| `resume_version_id` | uuid NULL REFERENCES `resume_versions(id)` |
| `job_snapshot` | jsonb |
| `match_score` | numeric(5,2) |
| `events` | jsonb | inline timeline (or separate table) |
| `local_agent_run_id` | text |
| `applied_at` / `created_at` / `updated_at` | timestamptz |

Indexes: `(user_id, created_at desc)`, `(user_id, status)`, `(user_id, resume_version_id)`.

RLS: all four CRUD policies scoped `using (user_id = auth.uid())`.

GRANT `select, insert, update, delete` to `authenticated`; `all` to `service_role`.

### 3c. `public.resume_versions`

| Column | Type |
|---|---|
| `id` | uuid PK default gen_random_uuid() |
| `user_id` | uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE |
| `label` | text |
| `template_id` | text |
| `theme_id` | text |
| `resume_json` | jsonb NOT NULL |
| `ats_score` / `resume_health` / `jd_match` | numeric(5,2) |
| `job_id` | uuid NULL | optional link to discovered job |
| `created_at` | timestamptz default now() |

Indexes: `(user_id, created_at desc)`.
RLS: identical pattern; CRUD scoped to owner.

### 3d. `public.user_state`

Single-row per user for ephemeral cross-page selections.

| Column | Type |
|---|---|
| `user_id` | uuid PK REFERENCES auth.users(id) ON DELETE CASCADE |
| `selected_job_id` | uuid NULL |
| `selected_resume_version_id` | uuid NULL |
| `active_application_id` | uuid NULL |
| `updated_at` | timestamptz default now() |

RLS: `using (user_id = auth.uid())` for all ops.

---

## 4. Ownership Audit

| Endpoint | Current | Required ownership check |
|---|---|---|
| `getApplication` | `.eq("id", id).eq("user_id", userId)` (assumed) — **verify** | Must include `.eq("user_id", userId)` and return 404 (not 403) on mismatch |
| `getArtifact` | Loads artifact by id, then profile by userId | Add `.eq("user_id", userId)` on artifact query; reject if artifact.user_id ≠ userId |
| `renderApplicationResume` | Loads application+profile | Verify `application.user_id = userId` AND `resume_version.user_id = userId` before rendering |
| `updateApplicationStatus` (975) | Update by id | Add `.eq("user_id", userId)` to UPDATE WHERE |
| `updateApplicationFields` (1019) | Same | Same |
| `attachLocalAgentRun` (1056) | Updates application by id | Same |
| `getApplicationTimeline` (1087) | Reads by id | Same |
| `saveJobListing` (1124) / `unsaveJobListing` (1157) | Already scoped by user_id | OK — confirm RLS policy mirrors |
| `getSavedJobs` (1170) | Scoped | OK |
| `upsertInterview` / `deleteInterview` | Verify | Add user_id filter on UPDATE / DELETE |
| `discoverJobs` / `getDiscoveredJob` / `selectJobForResume` / `getProfileMetrics` (jobs.api.ts) | **Anonymous** — no middleware | Add `requireSupabaseAuth` middleware; key process cache by userId |
| `runJobSearch` (826) | Protected | OK |
| `getNotifications` (417) | Anonymous, returns hardcoded list | Add middleware; return per-user notifications |
| `analyzeJobListing` / `evaluateApplication` | Protected | OK |

Rule for all: **never trust ids from the client without `.eq("user_id", auth.uid())`** even with RLS — defense in depth.

---

## 5. Local Development Compatibility Audit

| Feature | Cloud-dependent after Phase 3? | Notes |
|---|---|---|
| Job discovery (LinkedIn/Naukri/Foundit/etc. scrapers) | No | Pure server-fn fetch over public URLs; runs in Worker runtime today, unchanged |
| Ollama (qwen3:8b) integration | No | Browser → `http://localhost:11434`. Phase 3 doesn't touch this path |
| Resume generation | No | Local templating; reads profile from server (Supabase), but template render is client-side React |
| PDF export | No | `pdf.ts` uses browser print or pdf-lib client-side |
| DOCX export | No | `docx.ts` client-side |
| Auth itself | **Yes — Supabase required** | Supabase Auth is the only cloud dependency Phase 3 adds. Without internet, sign-in fails. Mitigation: offline dev mode toggle that re-enables a single hardcoded demo session for `NODE_ENV !== 'production'` (NOT mockAuth — just a dev shim that returns a stub `{ id, email }` and bypasses bearer attach) |
| Local Agent | No | Talks to `http://localhost:<port>` from the browser; no change |

**Verdict:** Local-first philosophy preserved. Only auth requires connectivity, which is unavoidable for a multi-user app.

Windows 11 / 16GB RAM: no new resident services; Supabase Auth is HTTPS calls only.

---

## 6. Module Risk Assessment

| Module | Classification | Why |
|---|---|---|
| **Profile** | High Risk | Currently rendered from `InternalSeedProfile` + session overlay. Must switch to `getProfile` (already exists). Every section (skills/projects/certs) must read from server and mutate via `saveProfile`. Breakage if seed removed before wiring is complete |
| **Job Discovery** | Needs Changes | Server fns are unprotected — must add `requireSupabaseAuth` and key per-user cache. Process-global `JobCacheService` cache leaks across users in current state |
| **Resume Studio** | High Risk | `useResumeStore` persists across users on same browser (no userId in `persist` key); seeds from `InternalSeedProfile`. Need: per-user persist key, seed from `getProfile`, versions saved to `resume_versions` table |
| **Application Tracker** | High Risk | Entire store is `LocalApplicationRepository` (global localStorage). Server table + fns already exist (`getApplications`, `getApplication`, ...) but UI never calls them. Need full data-layer swap |
| **Dashboard** | Needs Changes | KPIs come from `useApplicationsStore` (local) + `useSession`. After Phase 3, must read from `getDashboard` server fn |
| **Activity** | Needs Changes | Sources from `useApplicationsStore`. Swap to `getActivity` |
| **Settings** | Safe | Only displays session name/email and signs out. Two-line swap to `supabase.auth` |
| **Autopilot** | Safe (this phase) | Not part of Phase 3 scope; tracked for later |
| **Auth pages** | High Risk | Total rewrite of SignIn/SignUp + add `/reset-password` route + add Google OAuth (Lovable broker) |

---

## 7. Migration Execution Plan (proposed order for Phase 3)

Strict order — each step is independently testable before the next.

1. **Supabase Auth enablement & schema gate**
   - Confirm Cloud is enabled.
   - Migration: create `profiles` (if columns missing), `applications`,
     `resume_versions`, `user_state`. Add RLS + GRANTs per §3.
   - Trigger: auto-insert profile row on `auth.users` insert.
2. **Auth client swap (frontend)**
   - Rewrite `SignInPage` / `SignUpPage` to call `supabase.auth.*`.
   - Add Google sign-in via `lovable.auth.signInWithOAuth("google")`.
   - Add `/reset-password` route.
   - Replace `_authenticated/route.tsx` with integration-managed
     `ssr:false` + `supabase.auth.getUser()` gate.
   - Add single `onAuthStateChange` listener in `__root.tsx` (filter to
     `SIGNED_IN/OUT/USER_UPDATED`).
   - Verify `AuthAttacher` is registered in `src/start.ts`.
3. **Delete mockAuth & rewire consumers**
   - New `useUser()` hook (wraps `supabase.auth.getUser()` + cache).
   - Update `SettingsPage`, `TopBar`, `dashboard.data.ts`,
     `profile.data.ts` to use it.
   - Delete `src/frontend/auth/mockAuth.ts`.
4. **Profile becomes source of truth**
   - `profile.data.ts` → consume `getProfile` server fn (TanStack Query).
   - Wire Add Skill / Add Project / Add Certification / Replace Resume
     buttons to `saveProfile` mutations with optimistic UI.
   - `useResumeStore` seed: replace `getInternalSeedProfile()` with
     a one-shot effect that hydrates from `getProfile` after auth.
   - Per-user `persist` key: `imperium-resume-studio-v1-${userId}`.
5. **Server fn ownership hardening**
   - Add `requireSupabaseAuth` to all `jobs.api.ts` fns and
     `getNotifications`.
   - Add `.eq("user_id", userId)` to every ownership-listed endpoint in §4.
6. **Applications: localStorage → server**
   - Replace `LocalApplicationRepository` with a server-backed
     repository calling `getApplications` / `updateApplicationFields` /
     `updateApplicationStatus` etc.
   - Delete `useApplicationsStore` localStorage seeds.
7. **Resume Versions: server table**
   - `saveVersion` writes to `resume_versions`; `restoreVersion` reads.
   - Versions list query keyed by userId.
8. **User state**
   - `selected_job_id` / `selected_resume_version_id` persisted in
     `user_state` so refresh/navigation/restart preserves context.
9. **Cleanup**
   - Remove dev fallback `getSeedOrEmpty()` from
     `ResumeGenerator.ts` (caller always supplies real profile).
   - Strip hardcoded `selectedJob` default in `useResumeStore`.
   - Delete `src/frontend/applications/state/repository.ts` localStorage
     impl (keep interface only if still useful for offline cache).
   - Clear AiCache on sign-out.
10. **Verification pass**
    - Two-account browser test: confirm zero cross-user data leakage in
      Resume / Applications / Dashboard.
    - Refresh + navigation persistence test for `selectedJob` /
      `selectedResume` / `applicationId`.
    - Local Ollama / PDF / DOCX export smoke test.

---

## Stop Condition

This document is the deliverable. No production code has been modified.
On approval, Phase 3 begins at step 1.
