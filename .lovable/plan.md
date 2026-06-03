
# Imperium V3 — Production Transformation Plan

You answered "everything" to all three questions. Honest scope check: this is realistically **5–7 follow-up messages of focused work**, not one. Trying to ship all 17 phases in a single turn produces shallow placeholders across the board and breaks the demo that already works. Below is the sequenced plan I'll execute. Approve and I start with Batch 1 immediately; each subsequent batch ships on your next "continue".

---

## Batch 1 — Foundation (Auth + Schema + Cleanup)
**Phases 1, 2, 5, 6, 15**

- Add Supabase Auth: email/password + Google (via Lovable broker), `_authenticated/route.tsx` gate, `/auth` page, logout, session listener at root.
- Migration: `profiles` table (name, email, phone, location, LinkedIn, GitHub, portfolio, skills[], experience[], education[], certifications[]) with RLS scoped to `auth.uid()`. Trigger to auto-create profile on signup.
- Re-scope existing tables (`applications`, `job_listings`, `candidate_profiles`) to per-user via `user_id` column; rewrite server functions to use `requireSupabaseAuth` instead of `supabaseAdmin`.
- Delete dead/duplicate code: stale `review.$id.tsx` reference cleanup, unused IMPERIUM/ Python tree is left alone (it's reference material, not built), audit `src/lib/imperium/*` for dead exports.
- Security: drop service-role-only access pattern in favor of RLS-scoped queries everywhere it's user data.

## Batch 2 — Landing + Onboarding (Phases 3, 4, 12)
- Premium landing page at `/` (Hero, Features, How It Works, Resume Engine, Job Engine, Tracking, FAQ, Pricing placeholder, CTA, Footer). Linear/Stripe-grade visual quality using existing design tokens.
- Move current dashboard to `/_authenticated/dashboard`.
- Onboarding wizard `/onboarding` after first signup → profile setup → resume upload → first search.
- Auto-transitions between Search → Studio → Review → Tracking.

## Batch 3 — RenderCV-grade Resume Studio (Phase 7)
- Live MD editor (left) + live HTML preview (right) using existing `rendercv.server.ts`.
- 3 templates already exist (classic/modern/compact); add 2 more (executive, technical) + template picker.
- Version history table + diff view + clone.
- ATS score panel (already exists, polish UI), keyword match %, missing/added skills, recruiter readability heuristic.
- PDF export via browser print-to-PDF (server-side PDF is out of scope for Cloudflare Worker runtime — see server-runtime constraints).
- Resume upload + parse (markdown only — DOCX parsing needs native libs, not available).

## Batch 4 — Job Search Engine (Phase 8)
- Keep RemoteOK + Remotive + Arbeitnow (working).
- Add **Adzuna** (free API, covers Indeed-style global listings including India) and **Jooble** (free API, 70+ countries).
- Add **LinkedIn connector** (account-owner profile read only — honest label "Your LinkedIn profile" not job search; LinkedIn's job-search API is partner-only).
- Naukri / Foundit / Internshala: honest "Coming soon — requires partner API access" badge.
- Filters (remote, salary, source), sorting, saved jobs, recent searches.
- Requires user to add `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `JOOBLE_API_KEY` secrets.

## Batch 5 — Review + Tracking + Visibility (Phases 9, 10, 11)
- Application Review Center: never auto-submit, [Apply] [Skip] [Save For Later] gates.
- Workflow logs UI: streaming timeline of each step (Searching → Reading JD → Extracting → ... → Ready For Review). Already partially built in `execution-timeline.tsx`; wire to real pipeline events.
- Tracking Dashboard: 8 statuses (Saved → Offer/Rejected), filters, search, sort, basic analytics charts.

## Batch 6 — UI Polish + Performance + QA (Phases 13, 14, 16, 17)
- Typography/spacing/hierarchy sweep across all routes using existing design tokens.
- Skeleton loaders, empty states, error states on every list/detail view.
- Code-split routes, lazy-load heavy components, query staleTime tuning.
- Manual QA pass: every button, every route, every form — invoke server fns, check logs.
- Final security re-scan, fix anything new.

---

## Technical decisions (locked unless you object)

- **No Supabase Edge Functions** — all logic in `createServerFn`.
- **PDF export** = browser print dialog (jsPDF/html2pdf bundle is heavy and the Worker runtime can't run headless Chrome).
- **DOCX import/export** = out of scope (no native lib support in Worker).
- **Real auth required** — demo mode is dropped. All data becomes per-user.
- **Migration of existing data** — existing `applications`/`job_listings` rows have no `user_id`; I'll add the column nullable, then prompt you to either wipe or assign to your account.

## What I will NOT do
- Generate fake testimonials/reviews. Testimonials section uses placeholder cards labeled as such.
- Fake Indeed/LinkedIn job search. Either real (Adzuna/Jooble) or labeled "Coming soon".
- Touch the `IMPERIUM/` Python reference tree — it's not part of the build.

---

**Approve and I'll execute Batch 1 (auth + profiles + per-user data + cleanup) in the next message.** Each batch is one message. Total: ~6 messages to complete all 17 phases properly.
