/**
 * modules/jobs/job_filter.ts
 * ==========================
 * Purpose      : Analyzes a single job posting (skills required, seniority,
 *                fit signals) so the matcher can score it.
 * Inputs       : Job description + candidate profile.
 * Outputs      : Structured job analysis.
 * Responsibility: Job-level reasoning. No source I/O, no persistence.
 */
export * from "@backend/ai/jd-analyzer/JobDescriptionAnalyzer.server";
