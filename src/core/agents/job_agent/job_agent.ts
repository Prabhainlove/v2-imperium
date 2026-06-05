/**
 * core/agents/job_agent/job_agent.ts
 * ==================================
 * Purpose      : Public entry point for the Job Agent. Bundles every module
 *                (jobs, resumes, cover letters, applications, interviews)
 *                behind one import.
 * Inputs       : Calls from routes / UI via TanStack server functions.
 * Outputs      : Whatever the underlying module returns (jobs, resumes,
 *                application records, etc.).
 * Responsibility: Stable facade. Routes should import from here, not from
 *                `src/lib/imperium/**` directly.
 */
export * as Brain from "@/lib/imperium/brain/brain.server";
export * as Jobs from "./modules/jobs/job_search";
export * as Resumes from "./modules/resumes/resume_builder";
export * as CoverLetters from "./modules/cover_letters/cover_letter_builder";
export * as Applications from "./modules/applications/application_tracker";
export * as Interviews from "./modules/interviews/interview_tracker";
