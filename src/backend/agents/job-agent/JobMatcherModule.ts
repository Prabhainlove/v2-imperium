/**
 * modules/jobs/job_matcher.ts
 * ===========================
 * Purpose      : Produces the final `JobScore` (match %, required vs
 *                preferred coverage, recommendation).
 * Inputs       : Job analysis + profile intelligence.
 * Outputs      : `JobScore` used to rank applications.
 * Responsibility: Scoring math + recommendation. Shares the analysis
 *                module with `job_filter`.
 */
export * from "@backend/ai/jd-analyzer/JobDescriptionAnalyzer.server";
