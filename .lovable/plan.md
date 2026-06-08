# Final Architecture — FYP-Review Friendly

Goal: a clean **`frontend/` + `backend/`** split where every folder and file is self-explanatory enough that a professor understands its purpose from the name alone. No deep nesting, no framework jargon, no `controller.ts` / `manager.ts` / `service.ts` mystery files.

---

## 1. Final Folder Tree

```text
src/
│
├── frontend/                      ← ALL UI code
│   │
│   ├── landing/                   ← Public marketing page
│   │   ├── LandingPage.tsx
│   │   ├── landing.css
│   │   ├── landing.logic.ts
│   │   ├── components/
│   │   │   ├── Hero.tsx
│   │   │   ├── About.tsx
│   │   │   ├── Features.tsx
│   │   │   ├── Bento.tsx
│   │   │   └── Footer.tsx
│   │   └── assets/                (images, 3D model, sprites)
│   │
│   ├── auth/                      ← Login / Signup
│   │   ├── AuthPage.tsx
│   │   ├── auth.css
│   │   ├── auth.logic.ts
│   │   ├── components/{LoginForm,SignupForm,ResetPasswordForm}.tsx
│   │   └── assets/
│   │
│   ├── onboarding/                ← First-run profile setup wizard
│   │   ├── OnboardingPage.tsx
│   │   ├── onboarding.css
│   │   ├── onboarding.logic.ts
│   │   └── components/{StepWelcome,StepProfile,StepGoals}.tsx
│   │
│   ├── dashboard/                 ← Home after login (overview + KPIs)
│   │   ├── DashboardPage.tsx
│   │   ├── dashboard.css
│   │   ├── dashboard.logic.ts
│   │   └── components/{KpiCard,ActivityFeed,ProgressChart,QuickActions}.tsx
│   │
│   ├── jobs/                      ← Job search & discovery
│   │   ├── JobsPage.tsx
│   │   ├── jobs.css
│   │   ├── jobs.logic.ts
│   │   ├── components/{JobCard,JobFilters,MatchScoreBadge,SourceMonitor}.tsx
│   │   └── assets/
│   │
│   ├── applications/              ← Tracked job applications
│   │   ├── ApplicationsPage.tsx
│   │   ├── applications.css
│   │   ├── applications.logic.ts
│   │   └── components/{ApplicationCard,StatusPill,ApplicationTimeline}.tsx
│   │
│   ├── profile/                   ← Candidate profile
│   │   ├── ProfilePage.tsx
│   │   ├── profile.css
│   │   ├── profile.logic.ts
│   │   └── components/{ProfileHeader,SkillList,ExperienceList,EducationList,ProjectList}.tsx
│   │
│   ├── resume/                    ← Resume builder / studio
│   │   ├── ResumePage.tsx
│   │   ├── resume.css
│   │   ├── resume.logic.ts
│   │   └── components/{ResumeEditor,ResumePreview,TemplatePicker,AtsScoreCard}.tsx
│   │
│   ├── interviews/                ← Interview tracker & prep
│   │   ├── InterviewsPage.tsx
│   │   ├── interviews.css
│   │   ├── interviews.logic.ts
│   │   └── components/{InterviewCard,InterviewSchedule,PrepNotes}.tsx
│   │
│   ├── skills/                    ← Skill inventory & gap analysis
│   │   ├── SkillsPage.tsx
│   │   ├── skills.css
│   │   ├── skills.logic.ts
│   │   └── components/{SkillMatrix,SkillGapChart,LearningSuggestions}.tsx
│   │
│   ├── autopilot/                 ← Automated apply workflow control
│   │   ├── AutopilotPage.tsx
│   │   ├── autopilot.css
│   │   ├── autopilot.logic.ts
│   │   └── components/{AutopilotControls,RunHistory,WorkflowSteps}.tsx
│   │
│   ├── activity/                  ← Full activity log
│   │   ├── ActivityPage.tsx
│   │   ├── activity.css
│   │   ├── activity.logic.ts
│   │   └── components/{ActivityList,ActivityFilters}.tsx
│   │
│   ├── search/                    ← Global search
│   │   ├── SearchPage.tsx
│   │   ├── search.css
│   │   ├── search.logic.ts
│   │   └── components/{SearchBar,SearchResults}.tsx
│   │
│   ├── settings/                  ← User settings & preferences
│   │   ├── SettingsPage.tsx
│   │   ├── settings.css
│   │   ├── settings.logic.ts
│   │   └── components/{AccountSettings,NotificationSettings,ThemeSettings}.tsx
│   │
│   ├── shell/                     ← App chrome (sidebar + topbar)
│   │   ├── AppShell.tsx           (wraps every authenticated page)
│   │   ├── Sidebar.tsx
│   │   ├── Topbar.tsx
│   │   └── shell.css
│   │
│   └── shared/                    ← Cross-page UI ONLY (no business logic)
│       ├── ui/                    (Button, Input, Card, Dialog, Badge…)
│       ├── hooks/                 (useMobile, useTheme, useToast)
│       ├── utils/                 (formatDate, cn, classnames helpers)
│       └── styles/
│           └── tokens.css         (CSS variables: colors, fonts, radii)
│
├── backend/                       ← ALL server code
│   │
│   ├── agents/                    ← Autonomous agents (one folder each)
│   │   ├── job-agent/             (job search + apply orchestration)
│   │   │   ├── JobAgent.ts
│   │   │   ├── JobSearchModule.ts
│   │   │   ├── JobScoringModule.ts
│   │   │   └── JobAgentMemory.ts
│   │   ├── research-agent/        (RESERVED — future: company/market research)
│   │   │   └── README.md
│   │   ├── code-agent/            (RESERVED — future: take-home assignments)
│   │   │   └── README.md
│   │   ├── interview-agent/       (RESERVED — future: interview prep & mock)
│   │   │   └── README.md
│   │   └── local-agent/           (Python desktop agent — Selenium automation)
│   │       └── (existing IMPERIUM/local_agent contents)
│   │
│   ├── ai/                        ← AI/LLM building blocks (one job each)
│   │   ├── ModelRouter.ts         (picks the right OpenRouter model)
│   │   ├── ReasoningEngine.ts     (JSON + text LLM calls + retry)
│   │   ├── PromptMemory.ts        (dedupe + cache by prompt signature)
│   │   ├── jd-analyzer/
│   │   │   └── JobDescriptionAnalyzer.ts
│   │   ├── ats-engine/
│   │   │   └── AtsScoreEngine.ts
│   │   ├── resume-optimizer/
│   │   │   └── ResumeOptimizer.ts
│   │   ├── cover-letter-writer/
│   │   │   └── CoverLetterWriter.ts
│   │   ├── match-engine/
│   │   │   ├── JobMatchEngine.ts
│   │   │   └── ProfileAnalyzer.ts
│   │   └── career-intelligence/
│   │       └── CareerInsightsEngine.ts
│   │
│   ├── jobs/                      ← Job sources & ranking
│   │   ├── LinkedInSource.ts
│   │   ├── NaukriSource.ts
│   │   ├── JobParser.ts
│   │   ├── JobScorer.ts
│   │   └── JobPipeline.ts         (fetch → parse → score → store)
│   │
│   ├── profile/                   ← Candidate profile data
│   │   ├── ProfileStore.ts        (read/write profile rows)
│   │   ├── ProfileImporter.ts     (LinkedIn / GitHub / file import)
│   │   ├── ProfileCompleteness.ts
│   │   ├── ResumeFileParser.ts    (PDF / DOCX → structured profile)
│   │   └── ProfileTypes.ts
│   │
│   ├── resume/                    ← Resume generation & rendering
│   │   ├── ResumeGenerator.ts
│   │   ├── ResumeRenderer.ts      (Markdown → PDF/HTML via RenderCV)
│   │   ├── AtsChecker.ts
│   │   └── templates/             (Markdown / YAML resume templates)
│   │
│   ├── applications/              ← Application tracking + readiness
│   │   ├── ApplicationTracker.ts
│   │   ├── ApplicationHistory.ts
│   │   ├── ApplicationReadiness.ts
│   │   └── ApplicationTypes.ts
│   │
│   ├── automation/                ← Browser/form automation bridge
│   │   ├── BrowserBridge.ts
│   │   ├── FormFiller.ts
│   │   ├── ResumeUploader.ts
│   │   └── WorkflowRunner.ts
│   │
│   ├── database/                  ← Supabase clients & types
│   │   ├── SupabaseClient.ts          (browser client — publishable key)
│   │   ├── SupabaseAdminClient.ts     (server — service role; .server.ts)
│   │   ├── AuthMiddleware.ts          (requireSupabaseAuth)
│   │   ├── AuthAttacher.ts            (attaches bearer to serverFn calls)
│   │   └── DatabaseTypes.ts           (generated Supabase types)
│   │
│   ├── api/                       ← Server-function RPC surface (one per page)
│   │   ├── jobs.api.ts                (getJobs, runJobSearch, saveJob…)
│   │   ├── applications.api.ts        (getApplications, approveApplication…)
│   │   ├── profile.api.ts             (getProfile, updateProfile, import…)
│   │   ├── resume.api.ts              (generateResume, optimizeResume…)
│   │   ├── interviews.api.ts
│   │   ├── dashboard.api.ts
│   │   ├── autopilot.api.ts
│   │   └── activity.api.ts
│   │
│   └── config/
│       ├── EnvConfig.ts               (process.env reader, validated)
│       └── BrainConfig.ts             (model IDs, temperatures, limits)
│
├── routes/                        ← THIN TanStack route files only (~5 lines each)
│   ├── __root.tsx                 (root layout — required by TanStack)
│   ├── index.tsx                  → renders <LandingPage />
│   ├── auth.tsx                   → renders <AuthPage />
│   ├── reset-password.tsx
│   ├── api/
│   │   └── public/
│   │       └── webhook.ts         (public HTTP endpoint)
│   └── _authenticated/
│       ├── route.tsx              → renders <AppShell><Outlet/></AppShell>
│       ├── dashboard.tsx          → <DashboardPage />
│       ├── jobs.tsx               → <JobsPage />
│       ├── applications.tsx       → <ApplicationsPage />
│       ├── profile.tsx            → <ProfilePage />
│       ├── resume.tsx             → <ResumePage />
│       ├── interviews.tsx
│       ├── skills.tsx
│       ├── autopilot.tsx
│       ├── activity.tsx
│       ├── search.tsx
│       ├── settings.tsx
│       └── onboarding.tsx
│
├── assets/                        ← Truly global assets (favicon, og-image)
├── docs/                          ← Project documentation for the FYP report
│   ├── ARCHITECTURE.md
│   ├── DATA-MODEL.md
│   ├── AGENTS.md
│   └── HOW-TO-RUN.md
│
├── router.tsx                     (TanStack router bootstrap — required)
├── server.ts                      (TanStack SSR entry — required)
├── start.ts                       (TanStack Start instance — required)
└── styles.css                     (one-line: @import frontend/shared/styles/tokens.css)
```

### Path aliases (`tsconfig.json` + `vite.config.ts`)
```json
"paths": {
  "@/*":        ["./src/*"],
  "@frontend/*":["./src/frontend/*"],
  "@shared/*":  ["./src/frontend/shared/*"],
  "@backend/*": ["./src/backend/*"]
}
```

### Per-page convention (the rule a professor can memorise in 10 seconds)
For every page folder `frontend/<name>/`:
| File | Purpose |
|---|---|
| `<Name>Page.tsx` | The page UI (JSX/HTML) |
| `<name>.css` | The page styling (scoped via class prefix, e.g. `.jobs-*`) |
| `<name>.logic.ts` | The page logic / hooks / data fetching |
| `components/` | Components used ONLY by this page |
| `assets/` | Images / icons used ONLY by this page |

Cross-page UI lives in `frontend/shared/`. Nothing else. No exceptions.

---

## 2. Folder Migration Plan

Current UI (besides landing) was deleted in a previous turn, so this is mostly **move + scaffold**.

### Step A — Create the two-root skeleton
Create empty `src/frontend/` and `src/backend/` with all subfolders shown above. Add `README.md` placeholders in reserved agent folders (`research-agent`, `code-agent`, `interview-agent`) so they survive in version control.

### Step B — Move landing into `frontend/landing/`
| From | To |
|---|---|
| `src/components/landing/LandingShell.tsx` | `src/frontend/landing/LandingPage.tsx` |
| `src/components/landing/sections/HeroSection.tsx` | `src/frontend/landing/components/Hero.tsx` |
| `src/components/landing/sections/BentoSection.tsx` | `src/frontend/landing/components/Bento.tsx` |
| `src/components/landing/sections/FooterCTASection.tsx` | `src/frontend/landing/components/Footer.tsx` |
| other `sections/*.tsx` | `src/frontend/landing/components/` (1-to-1, names simplified) |
| `src/components/landing/chrome/*` | `src/frontend/landing/components/` |
| `src/components/landing/useLenisScroll.ts` | `src/frontend/landing/landing.logic.ts` |
| `src/components/landing/KatanaSketchfab.tsx`, `KatanaSprite.tsx`, `ColdOpen.tsx`, `SlashText.tsx` | `src/frontend/landing/components/` |
| `src/assets/landing/**` | `src/frontend/landing/assets/**` |
| Landing-specific rules in `src/styles.css` | `src/frontend/landing/landing.css` |

### Step C — Move shared UI
| From | To |
|---|---|
| `src/components/ui/**` | `src/frontend/shared/ui/**` |
| `src/hooks/use-mobile.tsx` | `src/frontend/shared/hooks/useMobile.ts` |
| `src/hooks/use-workflow-autopilot.ts` | `src/frontend/shared/hooks/useWorkflowAutopilot.ts` |
| `src/lib/utils.ts` | `src/frontend/shared/utils/classnames.ts` |
| `src/lib/error-capture.ts`, `error-page.ts`, `lovable-error-reporting.ts` | `src/frontend/shared/utils/` |
| design-token rules in `src/styles.css` | `src/frontend/shared/styles/tokens.css` |

### Step D — Move backend
| From | To |
|---|---|
| `src/integrations/supabase/client.ts` | `src/backend/database/SupabaseClient.ts` |
| `src/integrations/supabase/client.server.ts` | `src/backend/database/SupabaseAdminClient.server.ts` |
| `src/integrations/supabase/auth-middleware.ts` | `src/backend/database/AuthMiddleware.ts` |
| `src/integrations/supabase/auth-attacher.ts` | `src/backend/database/AuthAttacher.ts` |
| `src/integrations/supabase/types.ts` | `src/backend/database/DatabaseTypes.ts` |
| `src/lib/config.server.ts` | `src/backend/config/EnvConfig.server.ts` |
| `src/lib/imperium/config.ts` | `src/backend/config/BrainConfig.ts` |
| `src/lib/imperium/brain/model-router.server.ts` | `src/backend/ai/ModelRouter.server.ts` |
| `src/lib/imperium/brain/reasoning.server.ts` | `src/backend/ai/ReasoningEngine.server.ts` |
| `src/lib/imperium/brain/memory.server.ts` | `src/backend/ai/PromptMemory.server.ts` |
| `src/lib/imperium/brain/job-analysis.server.ts` | `src/backend/ai/jd-analyzer/JobDescriptionAnalyzer.server.ts` |
| `src/lib/imperium/brain/profile-analysis.server.ts` | `src/backend/ai/match-engine/ProfileAnalyzer.server.ts` |
| `src/lib/imperium/brain/resume-optimizer.server.ts` | `src/backend/ai/resume-optimizer/ResumeOptimizer.server.ts` |
| `src/lib/imperium/brain/cover-letter-generator.server.ts` | `src/backend/ai/cover-letter-writer/CoverLetterWriter.server.ts` |
| `src/lib/imperium/brain/application-engine.server.ts` | `src/backend/applications/ApplicationReadiness.server.ts` |
| `src/lib/imperium/brain/career-intelligence.server.ts` | `src/backend/ai/career-intelligence/CareerInsightsEngine.server.ts` |
| `src/lib/imperium/brain/github-intel.server.ts` | `src/backend/profile/GithubIntel.server.ts` |
| `src/lib/imperium/brain/profile-import.server.ts` | `src/backend/profile/ProfileImporter.server.ts` |
| `src/lib/imperium/brain/brain.server.ts` | `src/backend/ai/index.ts` (facade) |
| `src/lib/imperium/profile/*` | `src/backend/profile/*` (renamed — see §3) |
| `src/lib/imperium/sources.server.ts` | split into `src/backend/jobs/LinkedInSource.server.ts`, `NaukriSource.server.ts`, etc. |
| `src/lib/imperium/pipeline.server.ts` | `src/backend/jobs/JobPipeline.server.ts` |
| `src/lib/imperium/rendercv.server.ts` | `src/backend/resume/ResumeRenderer.server.ts` |
| `src/lib/imperium/resume-render.ts` | `src/backend/resume/ResumeGenerator.ts` |
| `src/lib/imperium/server.functions.ts` | **split** into one file per page under `src/backend/api/*.api.ts` (see §5) |
| `src/lib/imperium/client.ts` | DELETED (replaced by per-page `.api.ts`) |
| `src/lib/imperium/format.ts` | `src/backend/applications/ApplicationFormatting.ts` |
| `src/lib/imperium/types.ts` | `src/backend/applications/ApplicationTypes.ts` |
| `src/core/agents/job_agent/**` | `src/backend/agents/job-agent/**` (renamed — see §3) |
| `src/core/agents/research_agent/index.ts` | `src/backend/agents/research-agent/README.md` |
| `src/core/agents/code_agent/index.ts` | `src/backend/agents/code-agent/README.md` |
| `src/core/agents/autogpt_agent/index.ts` | DELETED (superseded by job-agent orchestrator) |
| `src/core/automation/*` | `src/backend/automation/*` (renamed — see §3) |
| `src/core/brain/*` | DELETED (duplicates of `backend/ai/*` placeholders) |
| `IMPERIUM/local_agent/**` | `src/backend/agents/local-agent/**` |
| `src/lib/api/example.functions.ts` | DELETED (template stub) |

### Step E — Rewrite `src/routes/*` as thin route files
Each route file becomes ~5 lines: `createFileRoute(...)({ component: <Page> })` importing from `@frontend/<page>/<Page>Page`.

### Step F — Add path aliases & restart
Update `tsconfig.json` + `vite.config.ts` with the four aliases. `src/styles.css` shrinks to one `@import`.

### Step G — Scaffold every remaining page
Each page folder gets a placeholder `<Name>Page.tsx` (e.g. "Coming soon — Dashboard"), empty `<name>.css`, empty `<name>.logic.ts`, empty `components/`, empty `assets/`, and a thin route file. Real UI is built page-by-page in later turns.

---

## 3. Renamed Files (the FYP-readability table)

| Old (jargony) | New (self-explanatory) |
|---|---|
| `lib/imperium/brain/model-router.server.ts` | `backend/ai/ModelRouter.server.ts` |
| `lib/imperium/brain/reasoning.server.ts` | `backend/ai/ReasoningEngine.server.ts` |
| `lib/imperium/brain/memory.server.ts` | `backend/ai/PromptMemory.server.ts` |
| `lib/imperium/pipeline.server.ts` | `backend/jobs/JobPipeline.server.ts` |
| `lib/imperium/sources.server.ts` | `backend/jobs/{LinkedIn,Naukri,…}Source.server.ts` |
| `lib/imperium/rendercv.server.ts` | `backend/resume/ResumeRenderer.server.ts` |
| `lib/imperium/server.functions.ts` | `backend/api/<page>.api.ts` (split) |
| `lib/imperium/client.ts` | DELETED |
| `lib/imperium/format.ts` | `backend/applications/ApplicationFormatting.ts` |
| `lib/imperium/profile/agent-context.ts` | `backend/profile/AgentContextBuilder.ts` |
| `lib/imperium/profile/ats-score.ts` | `backend/profile/AtsScorer.ts` |
| `lib/imperium/profile/completeness.ts` | `backend/profile/ProfileCompleteness.ts` |
| `lib/imperium/profile/file-parse.ts` | `backend/profile/ResumeFileParser.ts` |
| `lib/imperium/profile/generators.ts` | `backend/profile/ProfileTextGenerators.ts` |
| `lib/imperium/profile/jd-analysis.ts` | `backend/profile/JobDescriptionLocalAnalysis.ts` |
| `lib/imperium/profile/link-validator.ts` | `backend/profile/LinkValidator.ts` |
| `lib/imperium/profile/quality-gate.ts` | `backend/profile/ProfileQualityGate.ts` |
| `lib/imperium/profile/types.ts` | `backend/profile/ProfileTypes.ts` |
| `core/agents/job_agent/job_agent.ts` | `backend/agents/job-agent/JobAgent.ts` |
| `core/agents/job_agent/agent_memory.ts` | `backend/agents/job-agent/JobAgentMemory.ts` |
| `core/agents/job_agent/planner.ts` | `backend/agents/job-agent/ApplicationPlanner.ts` |
| `core/agents/job_agent/state_manager.ts` | `backend/agents/job-agent/JobAgentState.ts` |
| `core/agents/job_agent/workflow_engine.ts` | `backend/agents/job-agent/WorkflowEngine.ts` |
| `core/agents/job_agent/modules/jobs/job_search.ts` | `backend/agents/job-agent/JobSearchModule.ts` |
| `core/agents/job_agent/modules/jobs/job_matcher.ts` | `backend/agents/job-agent/JobMatcherModule.ts` |
| `core/agents/job_agent/modules/jobs/job_filter.ts` | `backend/agents/job-agent/JobFilterModule.ts` |
| `core/agents/job_agent/modules/jobs/job_tracker.ts` | `backend/agents/job-agent/JobTrackerModule.ts` |
| `core/agents/job_agent/modules/resumes/resume_builder.ts` | `backend/agents/job-agent/ResumeBuilderModule.ts` |
| `core/agents/job_agent/modules/resumes/resume_optimizer.ts` | `backend/agents/job-agent/ResumeOptimizerModule.ts` |
| `core/agents/job_agent/modules/resumes/resume_templates.ts` | `backend/agents/job-agent/ResumeTemplatesModule.ts` |
| `core/agents/job_agent/modules/resumes/ats_checker.ts` | `backend/agents/job-agent/AtsCheckerModule.ts` |
| `core/agents/job_agent/modules/applications/application_tracker.ts` | `backend/agents/job-agent/ApplicationTrackerModule.ts` |
| `core/agents/job_agent/modules/applications/application_history.ts` | `backend/agents/job-agent/ApplicationHistoryModule.ts` |
| `core/agents/job_agent/modules/applications/application_status.ts` | `backend/agents/job-agent/ApplicationStatusModule.ts` |
| `core/agents/job_agent/modules/cover_letters/*` | `backend/agents/job-agent/CoverLetter*Module.ts` |
| `core/agents/job_agent/modules/interviews/*` | `backend/agents/job-agent/Interview*Module.ts` |
| `core/automation/automation_client.ts` | `backend/automation/AutomationClient.ts` |
| `core/automation/selenium_bridge.ts` | `backend/automation/SeleniumBrowserBridge.ts` |
| `integrations/supabase/client.ts` | `backend/database/SupabaseClient.ts` |
| `integrations/supabase/client.server.ts` | `backend/database/SupabaseAdminClient.server.ts` |
| `integrations/supabase/auth-middleware.ts` | `backend/database/AuthMiddleware.ts` |
| `integrations/supabase/auth-attacher.ts` | `backend/database/AuthAttacher.ts` |
| `integrations/supabase/types.ts` | `backend/database/DatabaseTypes.ts` |
| `hooks/use-mobile.tsx` | `frontend/shared/hooks/useMobile.ts` |
| `hooks/use-workflow-autopilot.ts` | `frontend/shared/hooks/useWorkflowAutopilot.ts` |
| `lib/utils.ts` | `frontend/shared/utils/classnames.ts` |

`.server.ts` suffix is preserved everywhere the file uses Node/Worker-only APIs — TanStack's import guard relies on this suffix to keep server code out of the client bundle. This is the one technical naming rule we cannot drop, but professors only need to be told once: **".server.ts = runs on the server, not in the browser."**

---

## 4. Files to MERGE

| Merge | Into | Why |
|---|---|---|
| `lib/imperium/brain/brain.server.ts` (re-export facade) + scattered re-exports in `core/agents/job_agent/modules/**/*.ts` | `backend/ai/index.ts` (single AI facade) | One import surface for all AI features |
| `core/brain/{context_manager,memory_manager,ollama_brain,task_router}.ts` (all empty placeholders) | DELETED — superseded by `backend/ai/` real modules | Avoid two "brain" folders confusing the reviewer |
| `lib/error-capture.ts` + `lib/error-page.ts` + `lib/lovable-error-reporting.ts` | `frontend/shared/utils/errorReporting.ts` | Three tiny error files → one |
| `core/agents/job_agent/modules/resumes/{resume_builder,resume_optimizer,resume_templates,ats_checker}.ts` (all 4 are pure re-exports) | `backend/agents/job-agent/ResumeModule.ts` | Each is 1-3 lines of re-export; merging removes 4 indirections |
| Same for `cover_letters/*` and `interviews/*` re-export-only files | `CoverLetterModule.ts`, `InterviewModule.ts` | Same reason |

---

## 5. Files to SPLIT

| Split | Into | Why |
|---|---|---|
| `lib/imperium/server.functions.ts` (one giant 800+ line file with all RPCs) | `backend/api/jobs.api.ts`, `applications.api.ts`, `profile.api.ts`, `resume.api.ts`, `interviews.api.ts`, `dashboard.api.ts`, `autopilot.api.ts`, `activity.api.ts` | Each page has its own RPC file — easy to demo "this page talks to this API" |
| `lib/imperium/sources.server.ts` (LinkedIn + Naukri + Indeed in one file) | `backend/jobs/LinkedInSource.server.ts`, `NaukriSource.server.ts`, `IndeedSource.server.ts` | One source = one file. Reviewer sees the source list at a glance. |
| `src/styles.css` (mixed tokens + landing CSS + global resets) | `frontend/shared/styles/tokens.css` (variables only) + `frontend/landing/landing.css` (landing rules) + tiny `src/styles.css` shim | Per-page CSS isolation; nothing global beyond design tokens |

---

## 6. Professor-Review Test (applied to every name above)

> *"Open the file. Can a professor say what it does from the name alone?"*

Examples of names that **pass**:
`JobsPage.tsx` · `ResumeRenderer.ts` · `JobMatchEngine.ts` · `ApplicationReadiness.ts` · `LinkedInSource.ts` · `AuthMiddleware.ts` · `Sidebar.tsx`

Names that **failed** the test and were renamed:
`pipeline.server.ts` → `JobPipeline.server.ts` · `rendercv.server.ts` → `ResumeRenderer.server.ts` · `format.ts` → `ApplicationFormatting.ts` · `agent_memory.ts` → `JobAgentMemory.ts` · `state_manager.ts` → `JobAgentState.ts` · `client.ts` (under `imperium/`) → deleted (ambiguous; replaced by per-page `*.api.ts`).

The only technical suffix that remains is `.server.ts` — required by the framework, easy to explain in one sentence.

---

## 7. Open Questions (decide before I build)

1. **CSS isolation**: keep class-prefix isolation (`.jobs-*`, `.dash-*`) or upgrade to hard `*.module.css` CSS Modules? *(Recommended: class prefix — simpler to explain.)*
2. **Page scaffolding**: scaffold ALL pages with "Coming soon" placeholders now (so the architecture is complete and routes resolve), or only create a page folder when we actually build that page's UI?
3. **Reserved agent folders** (`research-agent`, `code-agent`, `interview-agent`): keep as empty folders with `README.md` explaining "Future Work" (recommended for FYP), or omit entirely until implemented?

Once you answer these three, I will execute the migration in build mode.
