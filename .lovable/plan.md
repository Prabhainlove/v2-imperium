# Imperium V2 — Stabilization & Production Readiness

**Rule:** no new features. Every phase either fixes or removes. Phases are sequential; I'll pause for your approval between high-risk phases (1, 3, 10).

---

## Phase 0 — Preserve Internal Seed Profile

- New file: `src/backend/profile/InternalSeedProfile.ts` containing the full Dinesh dataset (name, skills, projects, education, certifications, achievements, resume, ATS, portfolio).
- Guard: export is dev-only (`if (import.meta.env.DEV)` / `process.env.NODE_ENV !== 'production'`); production import returns `null`.
- Strip `SAMPLE_PROFILE` from `ProfileTypes.ts` export surface; redirect dev consumers to the new file.
- Production UI never renders Dinesh PII (email, phone, LinkedIn, GitHub, LeetCode, HackerRank, resume filename). Replace with generic placeholders or hide.

## Phase 1 — Dead UI & Broken Functionality Audit

Repo-wide scan (`rg`) for: `TODO`, `FIXME`, `Coming Soon`, `ComingSoon`, `Placeholder`, `Mock`, `Demo`, `setTimeout(`, `onClick={() => {}}`, hardcoded statuses.

Deliverable: `.lovable/dead-ui-report.md` classifying each finding as Working / Broken / Fake / Placeholder, with a Fix-or-Remove decision per item. No middle state — every entry resolves in Phases 2–8.

## Phase 2 — Imperium Content Cleanup

- Replace external-company demo content (Google, Stripe, Razorpay, Meta, etc.) with Imperium-branded equivalents in seeded UI strings.
- Remove Dinesh references from any visible production string (dashboard, profile placeholders, demo applications, demo jobs).
- Centralize demo content in `src/frontend/shared/data/demoContent.ts` so future scrubs are one edit.

## Phase 3 — Profile = Source of Truth

- Enable Lovable Cloud (Supabase) if not already. Create `profiles` table (jsonb columns: personal, skills, experience, projects, education, certifications, preferences) + RLS + auto-create trigger on signup.
- Replace `mockAuth` with Supabase Auth (email/password + Google). Delete `src/frontend/auth/mockAuth.ts`. Auth gate uses managed `_authenticated/route.tsx` pattern with `supabase.auth.getUser()`.
- New server fns (`requireSupabaseAuth`): `getMyProfile`, `updateMyProfile`, `addSkill`, `addProject`, `addCertification`, `replaceResume`, `importResume`, `importLinkedin` (SSRF-safe).
- `useResumeStore`, `jobs.api.ts`, dashboard, etc. all read from `getMyProfile`. No `SAMPLE_PROFILE` reads in production code paths.
- All profile mutations survive refresh + navigation.

## Phase 4 — Job Discovery Recovery

- `discoverJobs` requires authenticated profile; rejects when profile incomplete (no silent SAMPLE_PROFILE fallback).
- `getDiscoveredJob` returns `null` cleanly; UI shows empty state.
- `selectedJob` persisted in Supabase `user_state` (or `profiles.selected_job_id`); survives refresh/navigation.
- Delete duplicate scoring — keep `JobRankingService.rankJob` only; remove `scoreJob`.
- Filter at retrieval: validate URL (HEAD or shape check), drop jobs older than 24h, drop entries missing title/company/description.
- Adapter cleanup: stabilize LinkedIn/Naukri/Foundit/Wellfound/RemoteOK/YC paths; remove Indeed/Glassdoor.
- Verification: `Frontend Developer / Hyderabad / Fresher` returns ≥5 relevant Indian jobs, no Germany/AI-Engineer leakage.

## Phase 5 — Resume Studio Recovery

- Remove hardcoded `94%` (`ResumePage.tsx:79`). Compute via `JdMatchEngine(resume, selectedJob, profile)`.
- Single ATS engine — delete duplicate. Keep `AtsEngine`.
- PDF/DOCX export = Preview: refactor so `PreviewPane`, `PrintRenderer`, `export/pdf.ts`, `export/docx.ts` all consume one template renderer with identical CSS (A4, page-break rules, font embedding).
- Stress test: 1/2/3-page resumes export without clipping/overlap.
- Wire Undo/Redo (Zustand `temporal`), Job dropdown (from real jobs cache), Version dropdown (from `versions[]`), Prev/Next (cycles versions).

## Phase 6 — Application Tracker Consolidation

- Create `applications` Supabase table (user_id, job_id, resume_version_id, status, applied_at, notes) + RLS.
- Server fns: `listMyApplications`, `getMyApplication`, `createApplication`, `updateApplicationStatus`, `deleteApplication` — all with ownership checks.
- Delete `localStorage` repository + `_seedDemo` (`useApplicationsStore.ts`).
- Wire filters, drawer file access, notifications, analytics to real data. Remove any control that can't be wired.

## Phase 7 — Dashboard Recovery

- All KPIs derived from `profile`, `applications`, `jobs_cache`, `resume_versions`. No hardcoded numbers.
- Remove fake achievements/progress. Remove dead CTAs/tabs.

## Phase 8 — Route Cleanup

Audit `src/routes/_authenticated/*`:

- **Keep & complete:** dashboard, profile, jobs, resume, applications, autopilot, settings, activity.
- **Remove (route file + navbar entry + page component):** assistant, ats (merge into resume), networking, recruiters, salary, search, skills, interviews (until built).
- Delete `ComingSoon` component and all `SalaryPage`-style stubs.

## Phase 9 — Flow Verification

Manual + scripted run-through:

```
Register → Profile → Discover Jobs → Job Details
   → Resume Studio → PDF Export → Apply
   → Application Tracker
```

Verify `selectedJob`, `selectedResume`, `applicationId` persist across refresh / navigation / browser restart (all Supabase-backed).

## Phase 10 — Security Recovery

1. Ownership assertions on `getApplication`, `getArtifact`, `renderApplicationResume`, every per-user server fn.
2. SSRF guard in `importProfileFromLinkedin`: allowlist `linkedin.com`, block private IPs, no redirect chasing.
3. `requireSupabaseAuth` on every server fn under `src/backend/ai/**` and `resume-ai.functions.ts`.
4. Upload validation in `ResumeFileParser`: MIME + ext + size (≤5MB) whitelist; reject macros.
5. Remove client-supplied profile in writes — server resolves profile from `userId`.
6. Delete `mockAuth` SHA-256 localStorage password store (covered in Phase 3).
7. Run `security--run_security_scan` and resolve findings.

## Phase 11 — Production Readiness Audit

Final pass produces `.lovable/production-readiness.md`:

- Fixed Issues
- Remaining Issues
- Routes Removed / Completed
- Flow Integrity Report
- Resume Export Verification (1/2/3-page screenshots)
- Profile Integration Report
- Job Discovery Report
- Application Tracker Report
- Security Re-scan Result
- Performance Notes (virtualization, localStorage usage)
- Production Readiness Score (/100) + Release Recommendation

---

## Execution Order & Approval Gates

```text
Phase 0  ─┐
Phase 1  ─┴─ batch 1 (low risk, do together)
Phase 2  ───  batch 2
Phase 3  ───  GATE: pause for approval (Supabase Auth + schema migration)
Phase 4  ─┐
Phase 5  ─┴─ batch 3
Phase 6  ───  batch 4
Phase 7  ─┐
Phase 8  ─┴─ batch 5
Phase 9  ───  verification
Phase 10 ───  GATE: security scan + approval
Phase 11 ───  final audit + release recommendation
```

I'll execute Phase 0 → Phase 2 immediately on approval, then stop at the Phase 3 gate so you can confirm the Supabase Auth + schema migration plan before I touch authentication.

**Approve to proceed with Phases 0–2.**

APPROVED WITH CHANGES

&nbsp;

1. Preserve Dinesh completely as InternalSeedProfile.

   Keep:

   - Name

   - Skills

   - Projects

   - Education

   - Certifications

   - Achievements

   - Resume Data

   - ATS Data

   - Portfolio Data

&nbsp;

   Remove only personal PII from production UI visibility.

   InternalSeedProfile remains available for development/testing/onboarding.

&nbsp;

2. Remove Interviews route completely.

   - Remove navbar item.

   - Remove route.

   - Remove page component.

   - No placeholder.

   - No coming soon.

&nbsp;

3. Keep Local Agent / Autopilot route untouched for now.

   - Do not develop.

   - Do not audit deeply.

   - Do not remove.

   - Revisit in future phase.

&nbsp;

4. Add Backend Dead Code Audit.

   Find:

   - Unused APIs

   - Unused server functions

   - Unused stores

   - Unused services

   - Unused routes

   - Unused components

   Output:

   - Keep

   - Merge

   - Remove

&nbsp;

5. Job Discovery validation must test:

   - Frontend Developer / Hyderabad / Fresher

   - Backend Developer / Remote

   - AI Engineer / 0-2

&nbsp;

   Report:

   Retrieved

   Filtered

   Ranked

   Displayed

&nbsp;

6. Job freshness:

   - Boost <= 3 days

   - Prefer <= 7 days

   - Allow <= 30 days

   - Exclude > 30 days

&nbsp;

7. Resume Studio acceptance:

   Preview = PDF = DOCX

   No clipping

   No overlap

   No missing sections

&nbsp;

8. Application Tracker acceptance:

   Persist:

   - Job ID

   - Resume Version

   - ATS Score

   - Match Score

   - Application Status

&nbsp;

9. Navigation after cleanup:

&nbsp;

   KEEP:

   - Dashboard

   - Profile

   - Jobs

   - Resume Studio

   - Applications

   - Activity

   - Settings

   - Local Agent (future)

&nbsp;

   REMOVE:

   - Interviews

   - Assistant

   - ATS

   - Networking

   - Recruiters

   - Salary

   - Search

   - Skills

   - Any ComingSoon page

&nbsp;

10. Priority flow only:

&nbsp;

   Profile

   ↓

   Job Discovery

   ↓

   Job Details

   ↓

   Resume Studio

   ↓

   Export PDF/DOCX

   ↓

   Apply

   ↓

   Application Tracker

&nbsp;

11. No new features until:

   - Dead UI fixed

   - Profile source of truth implemented

   - Job Discovery fixed

   - Resume Studio fixed

   - Application Tracker consolidated

   - Flow verification passed

   - Security audit passed

   - Production readiness audit completed

&nbsp;

Proceed with:

Phase 0 → Phase 2 first.

Pause at Phase 3 gate before authentication/schema changes.