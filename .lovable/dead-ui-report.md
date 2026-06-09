# Imperium V2 — Dead UI & Functionality Report (Phase 1)

Generated alongside Phases 0–2 + 8. Every item below is now either Fixed (in this batch) or Tracked for the explicit later phase. No item is left in a "middle" state.

## Routes & Pages

| Item | Classification | Decision | Status |
|---|---|---|---|
| `/_authenticated/assistant` (`AssistantPage`) | Placeholder (ComingSoon) | Remove | ✅ Deleted |
| `/_authenticated/ats` (`AtsPage`) | Placeholder (ComingSoon) — duplicates Resume Studio | Remove | ✅ Deleted |
| `/_authenticated/interviews` (`InterviewsPage`) | Placeholder | Remove | ✅ Deleted |
| `/_authenticated/networking` (`NetworkingPage`) | Placeholder (ComingSoon) | Remove | ✅ Deleted |
| `/_authenticated/recruiters` (`RecruitersPage`) | Placeholder (ComingSoon) | Remove | ✅ Deleted |
| `/_authenticated/salary` (`SalaryPage`) | Placeholder (ComingSoon) | Remove | ✅ Deleted |
| `/_authenticated/search` (`SearchPage`) | Skeleton ("UI coming soon") | Remove | ✅ Deleted |
| `/_authenticated/skills` (`SkillsPage`) | Skeleton ("UI coming soon") | Remove | ✅ Deleted |
| `ComingSoon` shared component | Dead | Remove | ✅ Deleted |
| `/_authenticated/settings` | Placeholder ("UI coming soon") | Fix | ✅ Replaced with real Account view (name/email/sign-out) |
| `/_authenticated/activity` | Placeholder ("UI coming soon") | Fix | ✅ Replaced with live activity stream from `useApplicationsStore` |
| `/_authenticated/onboarding` | Skeleton, still part of signup flow | Fix later (Phase 3) | ⚠ Kept; flagged for Phase 3 |
| `/_authenticated/autopilot` | Simulated work via `setTimeout` | Untouched per approval | ⚠ Tracked for future phase |

## Dead Buttons / Fake UI

| File | Item | Decision | Status |
|---|---|---|---|
| `applications/components/DetailsDrawer.tsx:187` | "Files" button: disabled, label "Coming soon" | Fix in Phase 6 | ⚠ Tracked |
| `landing/components/ColdOpen.tsx` | `setTimeout` cold-open animation | Legitimate intro animation | ✅ Keep |
| `resume/panes/ActionBar.tsx:107` | `setTimeout` redirect to `/applications` after Apply | UX delay; not simulation | ✅ Keep |
| `frontend/autopilot/AutopilotPage.tsx` | `setTimeout` "agent run" simulation | Defer (Local Agent untouched per approval) | ⚠ Tracked |
| `shared/hooks/useWorkflowAutopilot.ts` | `setTimeout` navigation nudge | Legitimate UX | ✅ Keep |
| `auth/components/AuthShell.tsx:41` | "VIDEO COMING SOON" label | Cosmetic placeholder | ⚠ Tracked (replace with brand video or remove in Phase 9) |

## Fake / Hardcoded Data

| File | Issue | Decision | Status |
|---|---|---|---|
| `frontend/applications/state/useApplicationsStore.ts:_seedDemo` | Demo seed with Google / Stripe / Razorpay / Swiggy / Zerodha / Flipkart | Fix | ✅ Replaced with Imperium-branded demo entries; entire seed disabled in Phase 6 |
| `frontend/dashboard/dashboard.data.ts` | Hardcoded `DINESH` identity + PII email | Fix | ✅ Replaced with neutral `BASE` Imperium identity |
| `frontend/dashboard/dashboard.data.ts:174-180` inventory | Locked "Interview Agent" / "Recruiter Agent" modules pointing to deleted routes | Fix | ✅ Removed from inventory |
| `frontend/resume/ResumePage.tsx:79` | Hardcoded `94%` match score | Fix in Phase 5 | ⚠ Tracked |
| `backend/api/jobs.api.ts:getProfileMetrics` | Hardcoded `profileStrength: 86` etc. | Fix in Phase 7 | ⚠ Tracked |
| `backend/agents/local-agent/storage/application_history.json` | Real Dinesh PII in local-agent sandbox storage | Defer (Local Agent untouched) | ⚠ Tracked |
| `backend/profile/ProfileTypes.ts` `SAMPLE_PROFILE` | PII-bearing seed exported repo-wide | Fix | ✅ Moved to `InternalSeedProfile.ts`, dev-only gate |
| `frontend/resume/state/useResumeStore.ts` | `selectedJob` defaulted to "Google / Senior Software Engineer" | Fix | ✅ Replaced with Imperium fixture; `null` in production |

## Disconnected / Mocked APIs (Tracked, not in this batch)

These remain to be addressed in the listed phases — flagged here for traceability:

- `imperium.api.ts:getApplication / getArtifact / renderApplicationResume` — missing ownership checks (Phase 10)
- `discoverJobs` — silent SAMPLE_PROFILE fallback removed, requires authenticated profile (Phase 4)
- `getDiscoveredJob` — clean `null` path on missing job (Phase 4)
- `selectedJob` persistence to Supabase `user_state` (Phase 4)
- Resume export (`pdf.ts`, `docx.ts`) — Preview≠Export drift (Phase 5)
- Application Tracker split-brain: `useApplicationsStore` localStorage vs Supabase (Phase 6)
- `ProfileImporter.server.ts` — SSRF guard (Phase 10)
- `mockAuth.ts` — replace with Supabase Auth (Phase 3)

## Summary

- **8 dead routes removed** (assistant, ats, interviews, networking, recruiters, salary, search, skills)
- **2 placeholder pages fixed** (settings, activity)
- **1 dead component removed** (`ComingSoon`)
- **PII scrubbed** from production code paths (`SAMPLE_PROFILE`, dashboard identity, resume seed selectedJob)
- **Demo company names rebranded** to Imperium-only entities
- **2 dead inventory modules removed** from dashboard

Navigation now contains only working pages: Dashboard, Jobs, Resume, Tracker, Local Agent, Profile.
