/**
 * modules/resumes/resume_optimizer.ts
 * ===================================
 * Purpose      : Rewrites the resume against a target job to improve ATS
 *                score and keyword coverage.
 * Inputs       : Current resume markdown + job description.
 * Outputs      : `ResumeOptimization` (new markdown + score delta).
 * Responsibility: Optimization reasoning only. No persistence.
 */
export * from "@/lib/imperium/brain/resume-optimizer.server";
