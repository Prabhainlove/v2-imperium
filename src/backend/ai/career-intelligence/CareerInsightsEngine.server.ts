/**
 * Imperium Brain — Career intelligence.
 * Aggregates signals from applications, saved jobs, and resume performance
 * into market & skill recommendations.
 */
import { brainJson } from "@backend/ai/ReasoningEngine.server";
import { brainKey, brainOnce } from "@backend/ai/PromptMemory.server";
import type { CareerInsight } from "@backend/ai/AiTypes";

export interface CareerInputSnapshot {
  candidate_role: string;
  candidate_skills: string[];
  total_applications: number;
  applied_count: number;
  interview_count: number;
  top_companies: string[];
  recent_job_titles: string[];
  avg_match_score: number;
}

function fallback(input: CareerInputSnapshot): CareerInsight {
  return {
    market_insights: [
      `${input.recent_job_titles.length} recent ${input.candidate_role} listings sampled.`,
      input.avg_match_score >= 0.6
        ? "Profile aligns well with current openings."
        : "Profile alignment is below target; refine skills section.",
    ],
    skill_recommendations: input.candidate_skills.slice(0, 4),
    learning_recommendations: ["Document measurable outcomes in resume bullets"],
    application_strategy:
      input.interview_count > 0
        ? "Double down on companies similar to those generating interviews."
        : "Increase tailoring quality before raising application volume.",
    growth_opportunities: ["Add 2-3 portfolio artifacts that prove core claims"],
  };
}

export async function generateCareerIntelligence(
  input: CareerInputSnapshot,
): Promise<CareerInsight> {
  const key = brainKey([
    "career-intel",
    input.candidate_role,
    input.candidate_skills.join(","),
    input.total_applications,
    input.applied_count,
    input.interview_count,
    input.avg_match_score.toFixed(2),
  ]);
  return brainOnce(key, async () => {
    try {
      const { data } = await brainJson<CareerInsight>({
        system:
          "You are Imperium Brain — career intelligence analyst. Output STRICT JSON only.",
        user: `Generate career intelligence. Return JSON keys:
market_insights (string[]), skill_recommendations (string[]),
learning_recommendations (string[]), application_strategy (string),
growth_opportunities (string[]).

Candidate role: ${input.candidate_role}
Skills: ${input.candidate_skills.join(", ")}
Total applications: ${input.total_applications}
Applied: ${input.applied_count}
Interviews: ${input.interview_count}
Avg job match: ${input.avg_match_score.toFixed(2)}
Top companies: ${input.top_companies.join(", ")}
Recent target titles: ${input.recent_job_titles.join(", ")}`,
        temperature: 0.3,
        max_tokens: 700,
      });
      if (data) return data;
    } catch {
      // fall through
    }
    return fallback(input);
  });
}
