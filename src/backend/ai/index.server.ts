/**
 * Imperium Brain — facade. Single import point for every workflow.
 * Server-only: imports OpenRouter model router and specialist modules.
 *
 * Brain is the centralized intelligence layer. Users never interact with
 * Brain directly; every workflow (search, resume studio, applications,
 * career intelligence, tracking) routes through this facade. There is no
 * standalone Brain page or chat surface — only smarter workflows.
 */
export { BRAIN_MODELS, routeBrainCall } from "./model-router.server";
export type { BrainModelCallInput, BrainModelCallResult } from "./model-router.server";
export { brainJson, brainText, extractJson } from "./reasoning.server";
export { analyzeProfile } from "./profile-analysis.server";
export { analyzeJob } from "./job-analysis.server";
export { optimizeResume } from "./resume-optimizer.server";
export { generateCoverLetter } from "./cover-letter-generator.server";
export { evaluateApplicationReadiness } from "./application-engine.server";
export { generateCareerIntelligence } from "./career-intelligence.server";
export type {
  JobScore,
  ProfileIntelligence,
  ResumeOptimization,
  CoverLetterPackage,
  ApplicationReadiness,
  CareerInsight,
} from "./types";
