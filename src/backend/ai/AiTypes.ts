/**
 * AI shared types (Brain layer). Client-safe (no secrets, no server imports).
 *
 * For convenience, this module also re-exports the Profile and Application
 * domain types so legacy `from "@backend/ai/AiTypes"` imports keep working.
 */
export * from "@backend/profile/ProfileTypes";
export * from "@backend/applications/ApplicationTypes";


export type BrainTaskKind =
  | "profile_analysis"
  | "job_analysis"
  | "job_scoring"
  | "resume_optimize"
  | "cover_letter"
  | "application_readiness"
  | "career_insight"
  | "generic";

export interface BrainModelInfo {
  id: string;
  label: string;
  free: boolean;
}

export interface BrainCallStats {
  model: string;
  attempts: number;
  duration_ms: number;
  cached: boolean;
  fallback_chain: string[];
}

export interface JobScore {
  match_score: number;        // 0..1 final ranking score
  confidence: number;         // 0..1 how sure brain is
  required_match: number;     // 0..1 required-skill coverage
  preferred_match: number;    // 0..1 preferred-skill coverage
  matched_skills: string[];
  missing_skills: string[];
  strength_alignment: string[];
  risk: "low" | "medium" | "high";
  difficulty: "easy" | "moderate" | "hard";
  interview_potential: number; // 0..1
  recommendation: "apply" | "consider" | "skip";
  reasoning: string;
}

export interface ProfileIntelligence {
  strengths: string[];
  weaknesses: string[];
  skill_gaps: string[];
  recommended_roles: string[];
  recommended_industries: string[];
  ats_score: number;          // 0..100
  competitive_position: string;
  growth_opportunities: string[];
  summary: string;
}

export interface ResumeAtsReport {
  ats_score: number;
  keyword_coverage: number;
  matched_skills: string[];
  missing_skills: string[];      // missing from profile entirely
  underutilized_skills: string[]; // in profile but not surfaced on resume
  recommendations: string[];
  resume_gaps: string[];
  primary_role: string;
  link_warnings: string[];
}

export interface ResumeOptimization {
  optimized_md: string;
  ats_score_before: number;
  ats_score_after: number;
  improvements: string[];
  added_keywords: string[];
  reasoning: string;
  ats_report?: ResumeAtsReport;
  quality_warnings?: string[];
}

export interface CoverLetterPackage {
  cover_letter_md: string;
  company_alignment: string;
  role_alignment: string;
  confidence: number;
  reasoning: string;
}

export interface ApplicationReadiness {
  readiness_score: number;     // 0..100
  success_probability: number; // 0..1
  risks: string[];
  recommended_improvements: string[];
  final_recommendation: "submit" | "revise" | "skip";
  reasoning: string;
}

export interface CareerInsight {
  market_insights: string[];
  skill_recommendations: string[];
  learning_recommendations: string[];
  application_strategy: string;
  growth_opportunities: string[];
}
