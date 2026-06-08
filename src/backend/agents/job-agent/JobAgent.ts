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
export * as Brain from "@backend/ai/index.server";
export * as Jobs from "./JobSearchModule";
export * as Resumes from "./ResumeBuilderModule";
export * as CoverLetters from "./CoverLetterBuilderModule";
export * as Applications from "./ApplicationTrackerModule";
export * as Interviews from "./InterviewTrackerModule";
