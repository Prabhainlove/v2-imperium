/**
 * Imperium Brain — Skill gap analyzer.
 * Compares candidate skills to the target role & recent market signals.
 * Returns ranked missing skills + a learning roadmap.
 */
import { brainJson } from "./reasoning.server";

export interface SkillGapInput {
  target_role: string;
  candidate_skills: string[];
  recent_job_titles: string[];
  recent_job_skills: string[];
}

export interface SkillGapItem {
  skill: string;
  importance: "critical" | "important" | "nice_to_have";
  rationale: string;
  resource_hint: string;
}

export interface SkillGapResult {
  target_role: string;
  matched_skills: string[];
  missing_skills: SkillGapItem[];
  roadmap_30_60_90: { thirty: string[]; sixty: string[]; ninety: string[] };
  summary: string;
  model: string;
}

function heuristicGap(input: SkillGapInput): SkillGapResult {
  const have = new Set(input.candidate_skills.map((s) => s.toLowerCase()));
  const counts = new Map<string, number>();
  for (const s of input.recent_job_skills) {
    const k = s.trim();
    if (!k) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const matched = input.candidate_skills.filter((s) =>
    input.recent_job_skills.some((j) => j.toLowerCase() === s.toLowerCase()),
  );
  const missing: SkillGapItem[] = ranked
    .filter(([s]) => !have.has(s.toLowerCase()))
    .slice(0, 12)
    .map(([s, n], idx) => ({
      skill: s,
      importance: idx < 3 ? "critical" : idx < 7 ? "important" : "nice_to_have",
      rationale: `Mentioned in ${n} recent ${input.target_role || "role"} listing(s).`,
      resource_hint: `Search for "${s} for ${input.target_role || "engineers"}" courses or docs.`,
    }));
  return {
    target_role: input.target_role,
    matched_skills: matched,
    missing_skills: missing,
    roadmap_30_60_90: {
      thirty: missing.slice(0, 2).map((m) => `Ship one project using ${m.skill}.`),
      sixty: missing.slice(2, 5).map((m) => `Add ${m.skill} to resume with measurable impact.`),
      ninety: missing.slice(5, 8).map((m) => `Get production exposure to ${m.skill}.`),
    },
    summary: missing.length
      ? `Close the top ${Math.min(3, missing.length)} gaps to lift match score for ${input.target_role || "your target role"}.`
      : "Your skills cover the recent market signal — focus on depth and proof.",
    model: "heuristic",
  };
}

export async function analyzeSkillGap(input: SkillGapInput): Promise<SkillGapResult> {
  const base = heuristicGap(input);
  try {
    const { data, model } = await brainJson<{
      missing_skills: SkillGapItem[];
      roadmap_30_60_90: { thirty: string[]; sixty: string[]; ninety: string[] };
      summary: string;
    }>({
      system:
        "You are Imperium Brain — career skill gap analyst. Return STRICT JSON only. Keys: missing_skills (array of {skill, importance: critical|important|nice_to_have, rationale, resource_hint}), roadmap_30_60_90 ({thirty, sixty, ninety: string arrays}), summary (string < 240 chars).",
      user: `Target role: ${input.target_role || "(unspecified)"}
Candidate skills: ${input.candidate_skills.join(", ") || "(none)"}
Recent job titles (market signal): ${input.recent_job_titles.slice(0, 12).join(", ")}
Aggregated recent job skills: ${input.recent_job_skills.slice(0, 30).join(", ")}

Identify the most important missing skills and a 30/60/90 day learning plan.`,
      temperature: 0.3,
      max_tokens: 900,
    });
    if (data && Array.isArray(data.missing_skills) && data.missing_skills.length) {
      return {
        target_role: input.target_role,
        matched_skills: base.matched_skills,
        missing_skills: data.missing_skills.slice(0, 12),
        roadmap_30_60_90: data.roadmap_30_60_90 ?? base.roadmap_30_60_90,
        summary: data.summary ?? base.summary,
        model,
      };
    }
  } catch {
    /* fall through to heuristic */
  }
  return base;
}
