/**
 * Imperium Brain — Job analysis and scoring.
 * Combines a deterministic heuristic floor with LLM-derived nuance so that
 * scoring is always returned (even when models are unreachable) and always
 * sorted by Brain confidence.
 */
import { brainJson } from "./reasoning.server";
import { brainKey, brainOnce } from "./memory.server";
import type { JobScore } from "./types";

export interface JobAnalysisInput {
  title: string;
  company: string;
  description: string;
  tech_stack: string[];
  location: string;
  remote: boolean;
  candidate_skills: string[];
  candidate_role: string;
  candidate_experience: string;
}

function heuristic(input: JobAnalysisInput): {
  match: number;
  matched: string[];
  missing: string[];
} {
  const text = `${input.title} ${input.description} ${input.tech_stack.join(" ")}`.toLowerCase();
  const matched: string[] = [];
  const missing: string[] = [];
  for (const raw of input.candidate_skills) {
    const s = raw.toLowerCase().trim();
    if (!s) continue;
    if (text.includes(s)) matched.push(raw);
    else missing.push(raw);
  }
  const skill_score = input.candidate_skills.length
    ? matched.length / input.candidate_skills.length
    : 0.4;
  const role_terms = input.candidate_role.toLowerCase().split(/\s+/).filter(Boolean);
  let role_hits = 0;
  for (const r of role_terms) if (input.title.toLowerCase().includes(r)) role_hits++;
  const role_score = role_terms.length ? role_hits / role_terms.length : 0.4;
  const match = Math.min(1, skill_score * 0.6 + role_score * 0.4);
  return { match, matched, missing };
}

function fallback(input: JobAnalysisInput): JobScore {
  const h = heuristic(input);
  const m = h.match;
  return {
    match_score: m,
    confidence: 0.55,
    required_match: m,
    preferred_match: m,
    matched_skills: h.matched,
    missing_skills: h.missing,
    strength_alignment: h.matched.slice(0, 3),
    risk: m >= 0.7 ? "low" : m >= 0.45 ? "medium" : "high",
    difficulty: m >= 0.7 ? "easy" : m >= 0.45 ? "moderate" : "hard",
    interview_potential: m,
    recommendation: m >= 0.65 ? "apply" : m >= 0.4 ? "consider" : "skip",
    reasoning: "Heuristic scoring (model unavailable).",
  };
}

export async function analyzeJob(input: JobAnalysisInput): Promise<JobScore> {
  const key = brainKey([
    "job-score",
    input.title,
    input.company,
    input.description.slice(0, 400),
    input.candidate_skills.join(","),
    input.candidate_role,
  ]);
  return brainOnce(key, async () => {
    const h = heuristic(input);
    try {
      const { data } = await brainJson<JobScore>({
        system:
          "You are Imperium Brain — a senior recruiter and matching engine. Output STRICT JSON only.",
        user: `Score this job for the candidate. Return JSON with keys:
match_score (0..1), confidence (0..1), required_match (0..1), preferred_match (0..1),
matched_skills (string[]), missing_skills (string[]), strength_alignment (string[]),
risk ("low"|"medium"|"high"), difficulty ("easy"|"moderate"|"hard"),
interview_potential (0..1), recommendation ("apply"|"consider"|"skip"),
reasoning (string under 240 chars).

Heuristic baseline: match=${h.match.toFixed(2)} matched=[${h.matched.join(", ")}] missing=[${h.missing.join(", ")}]

Job: ${input.title} @ ${input.company} (${input.location}${input.remote ? ", remote" : ""})
Tech: ${input.tech_stack.join(", ") || "—"}
Description (truncated): ${input.description.slice(0, 1100)}

Candidate role: ${input.candidate_role}
Candidate experience: ${input.candidate_experience}
Candidate skills: ${input.candidate_skills.join(", ")}`,
        temperature: 0.25,
        max_tokens: 700,
      });
      if (data && typeof data.match_score === "number") {
        // Trust heuristic skill arrays as the ground truth
        return {
          ...data,
          matched_skills: data.matched_skills?.length ? data.matched_skills : h.matched,
          missing_skills: data.missing_skills?.length ? data.missing_skills : h.missing,
        };
      }
    } catch {
      // fall through
    }
    return fallback(input);
  });
}
