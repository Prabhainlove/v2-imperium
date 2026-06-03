# Imperium V2 — Foundation Rebuild Plan

Transform Imperium from "resume generator" into a profile-first career OS organized around 5 systems. No new dashboards, no new agents, no experimental features. Everything routes through **Imperium Profile** (source of truth) and **Imperium Brain** (intelligence).

---

## Scope: 5 Systems Only

1. **Identity** — auth + guards
2. **Profile** — single source of truth + completeness engine
3. **Brain** — invisible intelligence layer (already scaffolded, will be hardened)
4. **Resume Studio** — rebuilt editor (markdown + live preview + ATS)
5. **Application Engine** — readiness scoring + tailored cover letters

All current pages map into these. No new routes added beyond what's listed.

---

## System 1 — Identity

**Keep**: `/auth` (login + signup), `_authenticated` route guard, onboarding guard.

**Add**:
- Forgot password flow → `/auth` adds "Forgot password?" → `supabase.auth.resetPasswordForEmail` → new `/reset-password` public route to set new password.
- Tighten profile-completion guard: redirect to `/onboarding` until `profiles.onboarded = true` AND minimum completeness reached (already partially in place — fix edge cases).

**Remove**: any duplicate auth components, dead login UI.

---

## System 2 — Profile (Source of Truth)

**Single profile system.** Today onboarding writes a partial `profiles` row and `/settings` edits separate fields. Consolidate.

**Onboarding rebuild** (`/onboarding`) — multi-step but lightweight:
1. Personal (name, headline, location, phone)
2. Career (target role, seniority, work mode, target locations, salary expectation)
3. Education (repeatable)
4. Experience (repeatable)
5. Skills (chips)
6. Projects (repeatable: name, description, stack, url)
7. Certifications (repeatable)
8. Links (LinkedIn URL, GitHub URL, Portfolio)
9. Languages + Achievements

**Single edit surface** (`/settings`) reuses the same section components — no duplicate forms. User can edit any section at any time.

**Schema additions** (migration):
- `profiles` add: `target_role`, `seniority`, `work_mode`, `target_locations jsonb`, `salary_expectation jsonb`, `projects jsonb`, `languages jsonb`, `achievements jsonb`.
- Existing columns (`skills`, `experience`, `education`, `certifications`, `linkedin_url`, `github_url`, `portfolio_url`) kept.

**Profile Completeness Engine** (`src/lib/imperium/profile/completeness.ts`):
- 10 weighted categories → completion %, strength score, readiness score, missing sections list, top-3 recommendations.
- Surfaced as a persistent panel in `/settings` and a compact widget on `/dashboard`.

---

## GitHub & LinkedIn Intelligence

**GitHub** — server fn `analyzeGithub({ url })`:
- Fetch public profile + top repos via GitHub REST API (no auth required for public; rate-limited).
- Extract: languages, frameworks (parse README/package files), commit recency, repo complexity heuristic.
- Brain summarizes → tech stack, project summaries, skill mapping, resume bullet suggestions.
- Stored on profile as `github_intel jsonb`. Re-run on demand.

**LinkedIn** — URL only. No scraping, no credentials. Brain uses headline + summary + URL to enrich positioning. Stored as `linkedin_intel jsonb`.

Both surfaced in `/settings → Intelligence` section with "Refresh" buttons.

---

## System 3 — Brain (Harden Existing)

Brain modules already exist under `src/lib/imperium/brain/`. Changes:
- Keep OpenRouter model router + failover chain (already implemented).
- Add **persistent memory** layer: new table `brain_memory (user_id, kind, key_hash, payload jsonb, created_at)` so analyses (profile intel, job analysis, ATS scores, cover letters) survive process restarts and are reused.
- Wire `brainOnce` to check Supabase memory before LLM call.
- Add `profile-intelligence.server.ts` that composes profile + GitHub + LinkedIn intel into one canonical "ProfileIntelligence" object consumed by Resume, ATS, Job Matching, Application.

**Rule**: no React component imports Brain modules directly. All UI calls go through `server.functions.ts` wrappers.

---

## System 4 — Resume Studio (Rebuild)

Rebuild `/resume` with RenderCV-inspired UX:
- **Two-pane layout**: left = markdown editor (with section helpers), right = live HTML preview.
- **Top bar**: template switcher (Classic / Modern / Compact), Version History dropdown, "Target a job" button, Export PDF.
- **Generate from profile**: button calls Brain `optimizeResume` seeded with full ProfileIntelligence — produces a complete resume containing all required sections (summary, skills, projects, education, certs, experience, achievements, GitHub, LinkedIn).
- **Job targeting**: paste job URL/description → Brain returns tailored variant + ATS delta.
- **Versioning**: every generate/save snapshots into `resume_versions`.
- **PDF export**: server fn rendering markdown → HTML → PDF via existing rendercv pipeline (kept).

Removes: placeholder generators, dead resume components, ad-hoc forms.

---

## ATS Engine (Rebuild)

`src/lib/imperium/brain/ats.server.ts`:
- Deterministic scoring across 8 categories (completeness, keyword match, skills, projects, education, certs, experience, alignment).
- Brain provides keyword extraction from JD; scoring math is deterministic so users can see *why*.
- Returns: overall score, per-category breakdown, missing keywords, missing skills, prioritized suggestions, optimization potential.
- Shown in Resume Studio sidebar when a job is targeted, and on `/review/$id`.

---

## Job Matching (Rewire)

`/jobs` and `/search`:
- Pipeline: Search → ProfileIntelligence → per-job `analyzeJob` → match calc → rank.
- Each job card shows: match %, confidence, skill match, missing skills, risk, difficulty, recommendation + one-line reasoning.
- Sort by opportunity quality (match × confidence × freshness).
- Backend pipeline already routes via Brain — frontend cards updated to render the full intelligence payload (today shows only match_score).

---

## System 5 — Application Engine

`/applications` and `/review/$id`:
- Before applying, Brain runs `evaluateApplicationReadiness` (already scaffolded) — picks best resume version, best cover letter variant, surfaces application score, readiness, risks, success probability, final recommendation.
- Cover letters generated per-application using full profile + GitHub + JD + company context. Stored on application row.
- User reviews, edits inline, then marks applied. Brain recommends; user decides.

---

## Codebase Cleanup (audit pass)

- Remove unused/legacy components under `src/components/imperium/` not referenced by the 5 systems.
- Delete dead routes/files (e.g. any leftover strategist/experimental scaffolding).
- Fix known bugs: sidebar nav reload (use `<Link>` everywhere), resume export error paths, ATS edge cases, application status transitions, toast error surfacing on server-fn failures.
- Strip the entire `IMPERIUM/` Python folder from the repo (legacy backend, not used by the TanStack app).

---

## Technical Notes

**Stack boundaries**: All AI/data work in `createServerFn` under `src/lib/imperium/*.functions.ts`. UI calls via `useServerFn` + TanStack Query. No direct OpenRouter calls from client.

**Migrations**:
1. Extend `profiles` with new columns.
2. Create `brain_memory` table with RLS scoped to `auth.uid()` + grants for `authenticated` + `service_role`.

**No new pages** beyond `/reset-password`. Everything else fits into existing routes: `/auth`, `/onboarding`, `/dashboard`, `/search`, `/jobs`, `/resume`, `/applications`, `/review/$id`, `/settings`, `/activity`.

**Order of execution** (one shot):
1. DB migration (profiles + brain_memory).
2. Profile system (schema-driven sections, completeness engine, single edit surface).
3. GitHub + LinkedIn intelligence server fns + UI hooks.
4. Brain memory persistence + ProfileIntelligence composer.
5. Resume Studio rebuild.
6. ATS engine + Job Matching UI rewire.
7. Application engine UI surfacing.
8. Identity polish (forgot password + reset).
9. Cleanup pass (dead code, broken nav, IMPERIUM/ folder).

---

## Out of Scope (explicit)

- No new dashboards, agents, chatbots, or experimental AI features.
- No LinkedIn scraping or credential capture.
- No new top-level routes besides `/reset-password`.
- No changes to publishable Supabase keys or auth provider list (email + Google only, already configured).

Approve and I'll execute end-to-end in one pass.
