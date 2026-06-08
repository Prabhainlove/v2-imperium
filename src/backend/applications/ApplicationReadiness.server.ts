/**
 * Imperium Brain — Application readiness engine.
 */
import { brainJson } from "@backend/ai/ReasoningEngine.server";
import { brainKey, brainOnce } from "@backend/ai/PromptMemory.server";
import type { ApplicationReadiness, JobScore } from "@backend/ai/AiTypes";

export interface ApplicationReadinessInput {
  job_score: JobScore;
  resume_ats_score: number;
  resume_excerpt: string;
  cover_letter_excerpt: string;
  job_title: string;
  company: string;
}

function fallback(input: ApplicationReadinessInput): ApplicationReadiness {
  const base = Math.round(
    input.job_score.match_score * 60 + (input.resume_ats_score / 100) * 40,
  );
  return {
    readiness_score: base,
    success_probability: Math.min(0.95, input.job_score.match_score),
    risks: input.job_score.missing_skills.slice(0, 3).map((s) => `Missing: ${s}`),
    recommended_improvements: input.job_score.missing_skills
      .slice(0, 3)
      .map((s) => `Highlight transferable experience for ${s}`),
    final_recommendation: base >= 70 ? "submit" : base >= 50 ? "revise" : "skip",
    reasoning: "Composite of job match and ATS readiness.",
  };
}

export async function evaluateApplicationReadiness(
  input: ApplicationReadinessInput,
): Promise<ApplicationReadiness> {
  const key = brainKey([
    "app-readiness",
    input.job_title,
    input.company,
    input.job_score.match_score,
    input.resume_ats_score,
    input.resume_excerpt.slice(0, 200),
  ]);
  return brainOnce(key, async () => {
    try {
      const { data } = await brainJson<ApplicationReadiness>({
        system:
          "You are Imperium Brain — application strategist. Output STRICT JSON only.",
        user: `Evaluate application readiness. Return JSON keys:
readiness_score (0..100), success_probability (0..1),
risks (string[]), recommended_improvements (string[]),
final_recommendation ("submit"|"revise"|"skip"), reasoning (string under 240 chars).

Role: ${input.job_title} @ ${input.company}
Job match: ${input.job_score.match_score.toFixed(2)} (conf ${input.job_score.confidence.toFixed(2)})
Matched skills: ${input.job_score.matched_skills.join(", ")}
Missing skills: ${input.job_score.missing_skills.join(", ")}
Resume ATS: ${input.resume_ats_score}/100

Resume excerpt:
${input.resume_excerpt.slice(0, 900)}

Cover letter excerpt:
${input.cover_letter_excerpt.slice(0, 500)}`,
        temperature: 0.25,
        max_tokens: 600,
      });
      if (data && typeof data.readiness_score === "number") return data;
    } catch {
      // fall through
    }
    return fallback(input);
  });
}
