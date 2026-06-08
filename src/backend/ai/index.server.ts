/**
 * Imperium Brain — facade. Single import point for every workflow.
 * Server-only: imports OpenRouter model router and specialist modules.
 *
 * Brain is the centralized intelligence layer. Users never interact with
 * Brain directly; every workflow (search, resume studio, applications,
 * career intelligence, tracking) routes through this facade. There is no
 * standalone Brain page or chat surface — only smarter workflows.
 */
export { BRAIN_MODELS, routeBrainCall } from "@backend/ai/ModelRouter.server";
export type { BrainModelCallInput, BrainModelCallResult } from "@backend/ai/ModelRouter.server";
export { brainJson, brainText, extractJson } from "@backend/ai/ReasoningEngine.server";
export { analyzeProfile } from "@backend/ai/match-engine/ProfileAnalyzer.server";
export { analyzeJob } from "@backend/ai/jd-analyzer/JobDescriptionAnalyzer.server";
export { optimizeResume } from "@backend/ai/resume-optimizer/ResumeOptimizer.server";
export { generateCoverLetter } from "@backend/ai/cover-letter-writer/CoverLetterWriter.server";
export { evaluateApplicationReadiness } from "@backend/applications/ApplicationReadiness.server";
export { generateCareerIntelligence } from "@backend/ai/career-intelligence/CareerInsightsEngine.server";
export type {
  JobScore,
  ProfileIntelligence,
  ResumeOptimization,
  CoverLetterPackage,
  ApplicationReadiness,
  CareerInsight,
} from "@backend/ai/AiTypes";
