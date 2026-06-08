/**
 * modules/resumes/ats_checker.ts
 * ==============================
 * Purpose      : Lightweight ATS keyword check for a resume + job pair.
 * Inputs       : Resume markdown + job description.
 * Outputs      : `QuickAts` score + missing keywords.
 * Responsibility: Heuristic scoring — no LLM call, safe for client use.
 */
export { quickAts, extractKeywords, analyzeReadability } from "@backend/resume/ResumeGenerator";
export type { QuickAts, ReadabilityReport } from "@backend/resume/ResumeGenerator";
