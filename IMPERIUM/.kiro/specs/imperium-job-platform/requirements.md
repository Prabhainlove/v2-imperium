# Requirements Document

## Introduction

The Imperium Job Platform transforms the existing Imperium autonomous agent infrastructure into a
production-grade, end-to-end job acquisition system. A user provides a candidate profile and a
natural-language command; the platform autonomously discovers jobs across 11+ sources, scores and
ranks them, generates per-job tailored resumes and cover letters, fills and submits applications on
supported portals (Greenhouse, Lever, Workday, Ashby, SmartRecruiters), tracks each application
through a 9-state machine, and streams every execution step live to a real-time dashboard. The
system is orchestrated by the Imperium Kernel and delegates work to the Job Agent, Research Agent,
Coding Agent, and Automation Agent through the existing WorkflowEngine and MessageBus.

## Glossary

- **System**: The Imperium Job Platform as a whole (backend, agents, and frontend combined).
- **Job_Search_Engine (JSE)**: Component responsible for fetching, normalizing, and deduplicating job postings from all configured sources.
- **Job_Intelligence_Engine (JIE)**: Component that extracts structured intelligence from job descriptions and computes multi-dimensional match scores.
- **Resume_Optimization_Engine (ROE)**: Component that generates ATS-optimized, keyword-dense, role-specific resumes as versioned PDF and plain-text artifacts.
- **Cover_Letter_Engine (CLE)**: Component that generates personalized, company-specific cover letters.
- **Application_Automation_Engine (AAE)**: Component that detects portal type, maps form fields, fills forms, uploads documents, and submits applications using a Playwright-controlled browser.
- **Application_Tracking_System (ATS)**: Component that implements the 9-state application state machine and persists all transitions.
- **Live_Execution_Layer (LEL)**: Component that publishes granular execution events from agents and engines to the frontend via Server-Sent Events (SSE).
- **ExecutionEventBus**: In-process pub/sub bus (asyncio.Queue per session) that routes execution events from producers to the LEL.
- **Imperium_Kernel**: Top-level orchestrator that dispatches tasks to agents through the WorkflowEngine and MessageBus.
- **Job_Agent**: Primary agent that coordinates JSE, JIE, ROE, CLE, AAE, and ATS for a single pipeline run.
- **Research_Agent**: Agent that performs company deep-research and returns CompanyIntel.
- **Coding_Agent**: Agent that extracts form schemas from portal DOM structures.
- **Automation_Agent**: Agent that executes browser-based form filling and submission.
- **CandidateProfile**: Structured object containing the user's personal information, skills, work experience, and job preferences.
- **JobListing**: Normalized representation of a job posting stored in the database.
- **RawJobPosting**: Un-normalized posting as returned directly from a source.
- **ScoredJobListing**: A JobListing enriched with match_score, ats_score, interview_probability, and application_priority.
- **JobIntelligence**: Structured data extracted from a job description (required skills, experience level, tech stack, work arrangement, etc.).
- **MatchBreakdown**: Per-dimension breakdown of the composite match score (skill overlap, experience fit, salary fit, location fit, trajectory fit).
- **ResumeArtifact**: Versioned resume object containing file_path (PDF), text_content, ats_score, and ATSReport.
- **ATSReport**: Report listing present keywords, missing keywords, coverage percentage, and formatting issues.
- **CoverLetterArtifact**: Generated cover letter object containing file_path, text_content, and word_count.
- **FormSchema**: Structured representation of an application form's fields extracted from the portal DOM.
- **SubmissionResult**: Object returned by AAE describing the outcome of a submission attempt.
- **ApplicationRecord**: Database record representing a single job application with its current status.
- **ApplicationStatus**: Enumeration of the 9 application states: DISCOVERED, SHORTLISTED, RESUME_GENERATED, READY_TO_APPLY, SUBMITTED, UNDER_REVIEW, INTERVIEW, OFFER, REJECTED.
- **ExecutionEvent**: Typed event object published to the ExecutionEventBus containing event_type, title, detail, data, and emitted_at.
- **StrategySnapshot**: User-configured strategy settings including min_match_threshold, daily_application_limit, and auto_apply_enabled.
- **CompanyIntel**: Research data about a company including size_category, tech_stack, culture_notes, and hiring_pace.
- **Pipeline**: A single end-to-end run triggered by one POST /api/job-platform/run request.
- **Session**: A unique run identified by session_id, associated with one SSE channel and one Pipeline execution.
- **VALID_TRANSITIONS**: The set of allowed state transitions in the ATS state machine as defined in the design.
- **InvalidTransitionError**: Exception raised when an ATS transition is not in VALID_TRANSITIONS for the current state.
- **Portal**: An online job application portal (Greenhouse, Lever, Workday, Ashby, SmartRecruiters, or Generic).
- **content_hash**: SHA-1 hash of title + company + location used for cross-source job deduplication.

---

## Requirements

### Requirement 1: Pipeline Orchestration

**User Story:** As a job seeker, I want to provide a natural-language command and my candidate profile and have the platform run the full job acquisition pipeline autonomously, so that I can receive submitted applications without manual intervention.

#### Acceptance Criteria

1. WHEN a user submits a POST request to `/api/job-platform/run` with a valid `CandidateProfile` and a command string, THE System SHALL create a unique `session_id`, open an SSE channel for that session, and return `{session_id, stream_url}` in the response.
2. WHEN the pipeline is started, THE Imperium_Kernel SHALL dispatch the pipeline task to the Workflow Agent, which delegates to the Job_Agent for execution.
3. WHEN the pipeline begins, THE System SHALL publish a `PIPELINE_START` event to the ExecutionEventBus with the session_id, command, and profile name.
4. WHEN the pipeline completes, THE System SHALL publish a `PIPELINE_COMPLETE` event containing `total_discovered`, `total_parsed`, `total_qualified`, `total_submitted`, and `duration_seconds`.
5. IF the pipeline encounters a fatal error, THEN THE System SHALL publish a `PIPELINE_ERROR` event and return a structured error response; the pipeline SHALL NOT leave partial state without a corresponding error event.
6. THE System SHALL enforce that `result.total_discovered >= result.total_shortlisted >= result.total_submitted` upon pipeline completion.
7. WHEN `auto_apply_enabled` is False in the StrategySnapshot, THE System SHALL set all submission results to `status="manual_required"` and `submitted=False` without attempting any portal interaction.

---

### Requirement 2: Job Search and Discovery

**User Story:** As a job seeker, I want the platform to search across all configured job sources in parallel, so that I get comprehensive job coverage with minimal wait time.

#### Acceptance Criteria

1. WHEN `search_all_sources` is called, THE Job_Search_Engine SHALL query all 11 configured sources concurrently using `asyncio.gather` and return a combined list of `RawJobPosting` objects.
2. WHEN a source request fails or returns an error, THE Job_Search_Engine SHALL log a warning, skip that source, and continue with the remaining sources without raising an exception.
3. WHEN searching sources, THE Job_Search_Engine SHALL emit a `STEP_PROGRESS` ExecutionEvent to the ExecutionEventBus for each source attempted, identifying the source by name.
4. THE Job_Search_Engine SHALL enforce per-source rate limits (default: 2 req/s for LinkedIn, 5 req/s for public APIs) to prevent IP bans.
5. WHEN `search_all_sources` is called with a non-empty `roles` list and a non-empty `locations` list, THE Job_Search_Engine SHALL return only postings where each `RawJobPosting.source` is a valid `JobSource` value and each `RawJobPosting.url` is non-empty.
6. THE Job_Search_Engine SHALL normalize each `RawJobPosting` into a `JobListing` including salary parsing (multi-currency), location canonicalization, and skill extraction.
7. WHEN a newly normalized `JobListing` is created, THE System SHALL upsert it into the database using `INSERT OR IGNORE` on `(source, external_id)` to prevent duplicate rows.
8. WHEN a `JobListing` is upserted and is new, THE System SHALL publish a `JOB_DISCOVERED` event with the company name and title.

---

### Requirement 3: Job Deduplication

**User Story:** As a job seeker, I want duplicate job postings from different sources to be eliminated, so that I don't apply to the same job twice.

#### Acceptance Criteria

1. THE Job_Search_Engine SHALL deduplicate raw postings by computing a `primary_key` as `source + ":" + external_id` and a `content_key` as `sha1(title.lower() + company.lower() + location.lower())[:12]`.
2. WHEN two `RawJobPosting` objects share the same `primary_key` OR the same `content_key`, THE Job_Search_Engine SHALL include only the first-encountered posting in the deduplicated result.
3. WHEN deduplication is applied to a list of postings that already contains no duplicates, THE Job_Search_Engine SHALL return a list of the same length (idempotence).
4. THE Job_Search_Engine SHALL guarantee that all returned `JobListing` objects have unique `listing_id` values and that no two listings share the same `(source, external_id)` pair.

---

### Requirement 4: Job Intelligence and Scoring

**User Story:** As a job seeker, I want each discovered job to be scored against my profile across multiple dimensions, so that I can focus on applications with the highest probability of success.

#### Acceptance Criteria

1. WHEN `analyze_and_score` is called, THE Job_Intelligence_Engine SHALL use an LLM to extract `JobIntelligence` for each listing, including required_skills, nice_to_have_skills, experience_level, tech_stack, work_arrangement, visa_sponsorship, and role_type.
2. WHEN computing match scores, THE Job_Intelligence_Engine SHALL compute a composite `match_score` using the weights: skill_overlap × 0.40 + experience_fit × 0.20 + salary_fit × 0.15 + location_fit × 0.15 + trajectory_fit × 0.10, where each dimension is in [0.0, 1.0].
3. THE Job_Intelligence_Engine SHALL guarantee that the composite `match_score` is in [0.0, 1.0] for all inputs, including edge cases where the profile or listing has empty skill lists.
4. WHEN computing an `ats_score`, THE Job_Intelligence_Engine SHALL compute it as `matched_keywords / max(total_keywords, 1)` where keywords are drawn from `listing.required_skills` and the top 30 tokens from the job description; the result SHALL be in [0.0, 1.0].
5. WHEN company intel is available, THE Job_Intelligence_Engine SHALL call `Research_Agent.research_company(company_name)` for the top 20 companies in parallel to enrich scoring with `CompanyIntel`.
6. WHEN scoring is complete, THE Job_Intelligence_Engine SHALL publish a `JOB_SCORED` event for each listing containing company name, match_score, ats_score, and application_priority.
7. THE Job_Intelligence_Engine SHALL rank `ScoredJobListing` objects by `application_priority` (computed as `match_score × interview_probability × ats_score`) in descending order.

---

### Requirement 5: Threshold and Limit Enforcement

**User Story:** As a job seeker, I want the platform to only pursue jobs that meet my quality threshold and respect my daily application limit, so that I don't waste effort on poor matches or exceed my desired pace.

#### Acceptance Criteria

1. WHEN filtering qualified jobs, THE Job_Intelligence_Engine SHALL include only `ScoredJobListing` objects where `match_score >= strategy.min_match_threshold`.
2. THE System SHALL guarantee that the number of submitted applications in a single pipeline run does not exceed `strategy.daily_application_limit`.
3. WHEN a listing does not pass the safety gate (`JobSafetyController.evaluate(listing, strategy).allowed = False`), THE System SHALL skip that listing, emit a `STEP_PROGRESS` event with the reason, and NOT submit an application.
4. THE System SHALL guarantee that every application present in `result.submitted_applications` has `JobSafetyController.evaluate(listing, strategy).allowed = True`.

---

### Requirement 6: Resume Generation

**User Story:** As a job seeker, I want the platform to generate a tailored, ATS-optimized resume for each qualified job, so that my application passes automated screening.

#### Acceptance Criteria

1. WHEN `ResumeOptimizationEngine.generate` is called for a listing, THE Resume_Optimization_Engine SHALL produce a `ResumeArtifact` containing a PDF file at `file_path`, plain-text at `text_content`, and a populated `ATSReport`.
2. THE Resume_Optimization_Engine SHALL inject up to 6 keywords from the job description into the resume text using `inject_keywords`, prioritizing `required_skills` from `JobIntelligence`.
3. THE Resume_Optimization_Engine SHALL produce the resume in ATS-safe formatting: no tables, no columns, standard section headings, and a readable font in the PDF output.
4. WHEN PDF generation via `reportlab` or `weasyprint` fails, THE Resume_Optimization_Engine SHALL fall back to producing a plain-text artifact and SHALL NOT raise an exception.
5. THE Resume_Optimization_Engine SHALL store each generated resume in the `resume_versions` table with a version number incremented per `(profile_id, listing_id)` pair.
6. WHEN a resume is generated, THE System SHALL transition the corresponding application to `RESUME_GENERATED` status and publish a `RESUME_GENERATED` ExecutionEvent with the company name and `ats_score`.
7. THE Resume_Optimization_Engine SHALL compute an `ATSReport` that lists `present_keywords`, `missing_keywords`, `coverage_percent`, and `formatting_issues` for each generated resume.

---

### Requirement 7: Cover Letter Generation

**User Story:** As a job seeker, I want a personalized cover letter generated for each qualified job, so that each application stands out with company-specific relevance.

#### Acceptance Criteria

1. WHEN `CoverLetterEngine.generate` is called, THE Cover_Letter_Engine SHALL produce a `CoverLetterArtifact` with `file_path`, `text_content`, and `word_count`.
2. THE Cover_Letter_Engine SHALL target a word count in the range [250, 350]; IF the generated draft falls outside this range, THEN THE Cover_Letter_Engine SHALL trim or expand the text to comply.
3. WHEN `CompanyIntel` is available, THE Cover_Letter_Engine SHALL include an opening hook that references the company's product or mission from `CompanyIntel`.
4. THE Cover_Letter_Engine SHALL map the top 3 profile strengths to the top 3 job requirements with concrete evidence in the cover letter body.
5. THE Cover_Letter_Engine SHALL calibrate tone to be formal for enterprise companies and casual for startups, inferred from `CompanyIntel.size_category`.
6. WHEN a cover letter is generated, THE System SHALL transition the application to `READY_TO_APPLY` status and publish a `COVER_LETTER_DONE` ExecutionEvent with the company name.
7. THE Cover_Letter_Engine SHALL store each generated cover letter in the `cover_letter_versions` table with a version number per `(profile_id, listing_id)` pair.

---

### Requirement 8: Artifact Existence Before Submission

**User Story:** As a job seeker, I want to be sure the platform has prepared all required documents before it attempts to submit an application, so that no incomplete application is sent.

#### Acceptance Criteria

1. WHEN the pipeline prepares to submit an application, THE System SHALL verify that `resume.file_path` and `cover_letter.file_path` both exist on disk and are readable before calling `ApplicationAutomationEngine.submit`.
2. IF either artifact file is missing or unreadable at submission time, THEN THE System SHALL skip submission, set `SubmissionResult.status = "failed"`, and emit an `APP_FAILED` event with a descriptive error message.
3. THE System SHALL guarantee that for every application in `result.submitted_applications`, `file_exists(app.resume.file_path) = True` and `file_exists(app.cover_letter.file_path) = True`.

---

### Requirement 9: Application Automation and Portal Submission

**User Story:** As a job seeker, I want the platform to automatically fill and submit applications on supported portals, so that I don't have to manually complete each form.

#### Acceptance Criteria

1. WHEN `ApplicationAutomationEngine.submit` is called, THE Application_Automation_Engine SHALL detect the portal type from the listing URL using pattern matching and select the appropriate submission strategy (REST API or Playwright).
2. WHEN submitting to Greenhouse or Lever portals, THE Application_Automation_Engine SHALL attempt the REST API strategy first and fall back to Playwright only if the API attempt fails.
3. WHEN using Playwright for form filling, THE Application_Automation_Engine SHALL use `Coding_Agent.extract_form_schema(url)` to obtain the `FormSchema`, map profile fields to form selectors, fill each field, upload the resume and cover letter files, and navigate multi-page forms with `wait_for_load_state("networkidle")`.
4. WHEN a CAPTCHA is detected during a Playwright session, THE Application_Automation_Engine SHALL return `SubmissionResult(status="captcha_blocked", submitted=False)` without attempting submission, and SHALL NOT transition the application to SUBMITTED.
5. WHEN a transient failure occurs, THE Application_Automation_Engine SHALL retry up to 3 times before returning a failed result.
6. WHEN submission succeeds, THE Application_Automation_Engine SHALL capture a screenshot or extract confirmation text and include it in `SubmissionResult.confirmation_text` or `SubmissionResult.screenshot_path`.
7. THE Application_Automation_Engine SHALL emit `APP_STEP` ExecutionEvents before and after key automation steps (form fill start, file upload, form submit), including the portal name and a progress percentage.
8. THE Application_Automation_Engine SHALL never raise an unhandled exception; all errors SHALL be caught and returned in `SubmissionResult.error`.

---

### Requirement 10: Submission Confirmation

**User Story:** As a job seeker, I want confirmation that every recorded submission was actually received by the portal, so that I have proof of each application.

#### Acceptance Criteria

1. THE System SHALL guarantee that for every application in `result.submitted_applications` where `submission_result.submitted = True`, at least one of `submission_result.confirmation_text` or `submission_result.screenshot_path` is non-empty and non-null.
2. WHEN submission is verified, THE System SHALL publish an `APP_SUBMITTED` ExecutionEvent with the company name, job title, and confirmation details.
3. WHEN submission fails after all retries, THE System SHALL publish an `APP_FAILED` ExecutionEvent with the company name and a non-empty error description.

---

### Requirement 11: Application State Machine

**User Story:** As a job seeker, I want every application to be tracked through a well-defined lifecycle, so that I always know the current status of each application.

#### Acceptance Criteria

1. THE Application_Tracking_System SHALL maintain the following valid state transitions only: DISCOVERED → {SHORTLISTED, REJECTED}, SHORTLISTED → {RESUME_GENERATED, REJECTED}, RESUME_GENERATED → {READY_TO_APPLY, REJECTED}, READY_TO_APPLY → {SUBMITTED, REJECTED}, SUBMITTED → {UNDER_REVIEW, REJECTED}, UNDER_REVIEW → {INTERVIEW, REJECTED}, INTERVIEW → {OFFER, REJECTED}; OFFER and REJECTED are terminal states with no valid outgoing transitions.
2. WHEN a transition is requested for a state not in `VALID_TRANSITIONS[current_status]`, THE Application_Tracking_System SHALL raise `InvalidTransitionError` and leave the application in its current state.
3. WHEN a valid transition is executed, THE Application_Tracking_System SHALL insert a row in `application_status_history` with `(application_id, new_status, utc_now(), notes, metadata)` and update `applications.status` in the same database transaction.
4. WHEN an application has been in SUBMITTED status for 72 hours without a recruiter event, THE Application_Tracking_System SHALL automatically transition it to UNDER_REVIEW via a background task.
5. WHEN a `RecruiterEvent` is received, THE Application_Tracking_System SHALL apply the corresponding transition (UNDER_REVIEW → INTERVIEW, UNDER_REVIEW → REJECTED, INTERVIEW → OFFER, or INTERVIEW → REJECTED) and persist the transition.
6. THE Application_Tracking_System SHALL expose a `get_timeline(application_id)` function that returns all `StatusHistoryEntry` objects for an application ordered by timestamp ascending.

---

### Requirement 12: Live Execution Streaming

**User Story:** As a job seeker, I want to see every step of the pipeline in real time on my dashboard, so that I can monitor progress and quickly spot issues.

#### Acceptance Criteria

1. THE Live_Execution_Layer SHALL expose a `GET /api/stream/{session_id}` SSE endpoint that streams `ExecutionEvent` objects in the format `data: {json}\n\n` with an `event:` type header.
2. THE System SHALL emit a heartbeat `ping` event every 15 seconds on each open SSE channel to keep the connection alive.
3. WHEN a session has been inactive for 5 minutes, THE ExecutionEventBus SHALL automatically close the session and release its asyncio.Queue.
4. THE ExecutionEventBus SHALL guarantee that events published to a session are delivered to SSE subscribers in the order of their `emitted_at` timestamps.
5. THE ExecutionEventBus SHALL buffer events published before a subscriber connects for the duration of the session setup window, so that no events are lost.
6. WHEN an `ExecutionEvent` is published, THE System SHALL persist it to the `execution_traces` table with `(trace_id, session_id, event_type, event_data, emitted_at)`.
7. THE ExecutionEventBus SHALL use one `asyncio.Queue` per session with no shared state between sessions, ensuring session isolation.

---

### Requirement 13: Frontend Dashboards

**User Story:** As a job seeker, I want a multi-dashboard web interface that displays job discovery results, application status, resume artifacts, and live execution events, so that I have full visibility into my job search.

#### Acceptance Criteria

1. THE System SHALL provide a Job Discovery Dashboard displaying a command input box, a live execution log fed by SSE, a jobs grid showing each job's match_score and ats_score, and a source breakdown chart.
2. THE System SHALL provide an Application Dashboard displaying applications in a Kanban view with one column per ApplicationStatus, a timeline modal per application card, and filters by company, status, and date.
3. THE System SHALL provide a Resume & Cover Letter Dashboard displaying per-job artifact previews, the ATSReport (coverage percent, missing keywords), download links for PDF and plain-text versions, and a version history.
4. THE System SHALL provide an Activity Timeline displaying a chronological event feed color-coded by ExecutionEvent level (info, success, warning, error) with click-to-expand detail.
5. THE System SHALL provide an Agent Activity Monitor displaying active agents, per-agent step counts, an execution trace viewer, and error/warning counts.
6. WHEN the frontend receives an SSE event, THE System SHALL update the relevant dashboard in real time without requiring a page reload.

---

### Requirement 14: REST API

**User Story:** As a developer or power user, I want a complete REST API for the job platform, so that I can integrate with or automate the platform programmatically.

#### Acceptance Criteria

1. THE System SHALL expose `POST /api/job-platform/run` accepting `{command: str, profile: CandidateProfile}` and returning `{session_id: str, stream_url: str}`.
2. THE System SHALL expose `GET /api/job-platform/dashboard` returning aggregate statistics including total_discovered, total_submitted, and counts by ApplicationStatus.
3. THE System SHALL expose `GET /api/job-platform/jobs` returning a paginated list of `JobListing` objects enriched with scores.
4. THE System SHALL expose `GET /api/job-platform/applications` returning a paginated list of `ApplicationRecord` objects with their current status.
5. THE System SHALL expose `GET /api/job-platform/applications/{id}/timeline` returning the ordered `StatusHistoryEntry` list for the specified application.
6. THE System SHALL expose `GET /api/job-platform/resumes/{listing_id}` returning the latest `ResumeArtifact` and its `ATSReport` for the specified listing.
7. THE System SHALL expose `GET /api/job-platform/cover-letters/{listing_id}` returning the latest `CoverLetterArtifact` for the specified listing.
8. THE System SHALL expose `PATCH /api/job-platform/applications/{id}/status` allowing a manual status update, which SHALL be validated against `VALID_TRANSITIONS` before being applied.
9. THE System SHALL expose `GET /api/job-platform/agents/status` returning the current activity state of each active agent.

---

### Requirement 15: Database Persistence

**User Story:** As a job seeker, I want all discovered jobs, applications, artifacts, and execution traces to be persisted to the database, so that my data survives restarts and I can query historical results.

#### Acceptance Criteria

1. THE System SHALL persist each `JobListing` to the `job_listings` table including the columns `ats_score`, `interview_probability`, `application_priority`, `platform_type`, and `intel_json`.
2. THE System SHALL persist each `ResumeArtifact` to the `resume_versions` table including `version_id`, `profile_id`, `listing_id`, `version_num`, `file_path`, `text_content`, `content_hash`, `ats_score`, `ats_report_json`, and `generated_at`.
3. THE System SHALL persist each `CoverLetterArtifact` to the `cover_letter_versions` table including `version_id`, `profile_id`, `listing_id`, `version_num`, `file_path`, `text_content`, and `generated_at`.
4. WHEN an application status transition occurs, THE System SHALL insert a row into `application_status_history` within the same database transaction as the status update.
5. THE System SHALL persist each `ExecutionEvent` to the `execution_traces` table indexed by `(session_id, emitted_at)`.
6. THE System SHALL cache `CompanyIntel` in the `company_intel` table with a 24-hour TTL, returning the cached value if `last_researched` is within 24 hours.
7. THE System SHALL cache `FormSchema` in the `form_schemas` table with a 6-hour TTL per `(listing_id, url)` pair.

---

### Requirement 16: Error Handling and Resilience

**User Story:** As a job seeker, I want the platform to recover gracefully from individual source failures, LLM rate limits, and portal errors, so that a failure in one part of the pipeline does not abort the entire run.

#### Acceptance Criteria

1. WHEN a job source returns HTTP 429 or blocks the request, THE Job_Search_Engine SHALL skip the source for the current run, emit a `STEP_PROGRESS` warning event, and blacklist the source for 1 hour with exponential backoff on the next cycle.
2. WHEN the LLM API returns HTTP 429 during resume or cover letter generation, THE System SHALL apply exponential backoff for up to 3 retries; IF all retries fail, THEN THE System SHALL fall back to template-based generation and log that the LLM was unavailable.
3. WHEN a Research_Agent or Coding_Agent call times out after 30 seconds, THE System SHALL use `None` for `company_intel` or an empty `FormSchema` respectively, and the pipeline SHALL continue in degraded mode.
4. WHEN a duplicate `(source, external_id)` insert is attempted, THE System SHALL use `INSERT OR IGNORE` and SHALL NOT propagate a database constraint exception.
5. WHEN `ApplicationAutomationEngine.submit` encounters an unhandled exception, THE System SHALL catch it, populate `SubmissionResult.error` with a non-empty description, set `submitted=False`, and emit an `APP_FAILED` event.
6. WHEN a state machine `InvalidTransitionError` is raised during the pipeline, THE System SHALL log the error, leave the application in its current state, and continue processing remaining applications.

---

### Requirement 17: Security

**User Story:** As a job seeker, I want my credentials and personal data to be handled securely, so that sensitive information is not exposed.

#### Acceptance Criteria

1. THE System SHALL store portal and LinkedIn credentials exclusively in the OS keyring via the `keyring` library, and SHALL NOT write credential values to the database, config files, or log output.
2. THE System SHALL validate that artifact download paths are relative to the designated `artifacts_dir` using `Path.is_relative_to(artifacts_dir)` before serving any file, to prevent path traversal.
3. THE System SHALL pass profile and job description content to LLM APIs as data parameters, not as part of the system prompt, to prevent prompt injection.
4. THE System SHALL enforce per-source rate limits and apply human-like random delays (0.5–2 seconds) between Playwright actions to prevent IP bans and portal detection.

---

### Requirement 18: Performance

**User Story:** As a job seeker, I want the pipeline to complete in a reasonable time even when processing many jobs, so that I don't have to wait an excessively long time for results.

#### Acceptance Criteria

1. THE Job_Search_Engine SHALL execute all source queries concurrently using `asyncio.gather` so that total search time is bounded by the slowest single source (target: 8–12 seconds for Playwright-based sources).
2. THE System SHALL generate resumes and cover letters for qualified jobs concurrently in batches of 5 to stay within LLM rate limits, targeting a throughput of at least 10 resumes per minute.
3. THE Application_Automation_Engine SHALL support at most `max_browser_contexts` (default 3) simultaneous Playwright browser contexts, configurable via `AutomationAgentConfig`.
4. THE System SHALL use SQLite with WAL mode for concurrent reads in single-user deployments; WHERE a PostgreSQL deployment is configured, THE System SHALL use async SQLAlchemy for database access.
