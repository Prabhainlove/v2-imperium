/**
 * Imperium Brain — Job analysis and scoring.
 *
 * Single-source-of-truth pipeline:
 *   1. Deterministic pass via `analyzeJobDescription` (profile/jd-analysis.ts)
 *      — same engine used by resume optimizer, generators, ATS, cover letters.
 *   2. Skill matching via `skillMatches` (alias-aware: react/reactjs,
 *      node/node.js, k8s/kubernetes, etc.) — no more raw `string.includes`.
 *   3. LLM-derived nuance via `brainJson` (ranking, reasoning) layered on
 *      top of the deterministic facts; the LLM never invents skill lists.
 *   4. Hard fallback when models are unreachable — never throws, always
 *      returns a complete `JobScore`.
 */
import { brainJson } from "@backend/ai/ReasoningEngine.server";
import { brainKey, brainOnce } from "@backend/ai/PromptMemory.server";
import { analyzeJobDescription, skillMatches } from "@backend/profile/JobDescriptionLocalAnalysis";
import type { JobScore } from "@backend/ai/AiTypes";

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

interface HeuristicBreakdown {
  match: number;
  required_match: number;
  preferred_match: number;
  matched: string[];
  missing: string[];
  jd_required: string[];
  jd_preferred: string[];
}

function heuristic(input: JobAnalysisInput): HeuristicBreakdown {
  // B1: route through the canonical JD analyzer so scoring sees the same
  // required/preferred split that resume tailoring and cover letters use.
  const jd = analyzeJobDescription({
    title: input.title,
    company: input.company,
    description: input.description,
    tech_stack: input.tech_stack,
  });

  // B2: alias-aware skill matching (react vs react.js, k8s vs kubernetes…).
  const candidateText = input.candidate_skills.join(" ");
  const matched: string[] = [];
  const missing: string[] = [];
  for (const raw of input.candidate_skills) {
    const s = raw.trim();
    if (!s) continue;
    // A candidate skill counts as "matched" if the JD requires/prefers it
    // OR if it appears anywhere in the JD text.
    const inJd =
      jd.requiredSkills.some((j) => skillMatches(j, s)) ||
      jd.preferredSkills.some((j) => skillMatches(j, s)) ||
      skillMatches(
        s,
        `${input.title} ${input.description} ${input.tech_stack.join(" ")}`,
      );
    if (inJd) matched.push(raw);
    else missing.push(raw);
  }

  // Required / preferred coverage from the JD's perspective.
  const reqHits = jd.requiredSkills.filter((j) => skillMatches(j, candidateText)).length;
  const prefHits = jd.preferredSkills.filter((j) => skillMatches(j, candidateText)).length;
  const required_match = jd.requiredSkills.length ? reqHits / jd.requiredSkills.length : 0.6;
  const preferred_match = jd.preferredSkills.length ? prefHits / jd.preferredSkills.length : 0.5;

  // Role-title alignment.
  const role_terms = input.candidate_role.toLowerCase().split(/\s+/).filter(Boolean);
  let role_hits = 0;
  for (const r of role_terms) if (input.title.toLowerCase().includes(r)) role_hits++;
  const role_score = role_terms.length ? role_hits / role_terms.length : 0.4;

  // Location / remote alignment.
  const remote_bonus = input.remote ? 1 : 0.7;

  // Weighted blend — every signal capped at 1.
  const match = Math.min(
    1,
    required_match * 0.55 +
      preferred_match * 0.2 +
      role_score * 0.15 +
      remote_bonus * 0.1,
  );

  return {
    match,
    required_match,
    preferred_match,
    matched,
    missing,
    jd_required: jd.requiredSkills,
    jd_preferred: jd.preferredSkills,
  };
}

function fallback(input: JobAnalysisInput): JobScore {
  const h = heuristic(input);
  const m = h.match;
  return {
    match_score: m,
    confidence: 0.55,
    required_match: h.required_match,
    preferred_match: h.preferred_match,
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
    "job-score-v2",
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
          "You are Imperium Brain — a senior recruiter and matching engine. Output STRICT JSON only. Use the provided deterministic facts as ground truth; do NOT invent skill lists.",
        user: `Score this job for the candidate. Return JSON with keys:
match_score (0..1), confidence (0..1), required_match (0..1), preferred_match (0..1),
matched_skills (string[]), missing_skills (string[]), strength_alignment (string[]),
risk ("low"|"medium"|"high"), difficulty ("easy"|"moderate"|"hard"),
interview_potential (0..1), recommendation ("apply"|"consider"|"skip"),
reasoning (string under 240 chars).

DETERMINISTIC FACTS (use as ground truth):
- heuristic match: ${h.match.toFixed(2)}
- required-skill coverage: ${h.required_match.toFixed(2)} (${h.jd_required.join(", ") || "—"})
- preferred-skill coverage: ${h.preferred_match.toFixed(2)} (${h.jd_preferred.join(", ") || "—"})
- candidate skills aligned with JD: [${h.matched.join(", ")}]
- candidate skills missing from JD: [${h.missing.join(", ")}]

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
        // LLM may rephrase / re-rank, but skill arrays come from the
        // deterministic engine unless the LLM produced a richer list.
        return {
          ...data,
          required_match:
            typeof data.required_match === "number" ? data.required_match : h.required_match,
          preferred_match:
            typeof data.preferred_match === "number" ? data.preferred_match : h.preferred_match,
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

