/**
 * Imperium Brain — Profile intelligence.
 * Given a candidate profile (and optional LinkedIn/GitHub/portfolio context),
 * produces strengths, weaknesses, skill gaps, role/industry recommendations,
 * ATS assessment and growth opportunities. Cached per profile signature.
 */
import { brainJson } from "./reasoning.server";
import { brainKey, brainOnce } from "./memory.server";
import type { ProfileIntelligence } from "./types";

export interface ProfileInput {
  name: string;
  headline?: string;
  summary?: string;
  skills: string[];
  experience: unknown[];
  education: unknown[];
  linkedin_url?: string;
  github_url?: string;
  portfolio_url?: string;
  target_roles?: string[];
}

function fallback(input: ProfileInput): ProfileIntelligence {
  const skills = input.skills.slice(0, 6);
  return {
    strengths: skills.length
      ? [`Hands-on ${skills.join(", ")}`, "Direct delivery experience"]
      : ["Adaptable contributor"],
    weaknesses: skills.length < 5 ? ["Limited stated skill breadth"] : [],
    skill_gaps: [],
    recommended_roles: input.target_roles?.length
      ? input.target_roles
      : input.headline
      ? [input.headline]
      : [],
    recommended_industries: [],
    ats_score: skills.length >= 5 && input.summary ? 72 : 55,
    competitive_position: "Mid-market candidate with focused expertise.",
    growth_opportunities: ["Document measurable impact on each role"],
    summary: input.summary ?? `${input.headline ?? "Candidate"} ready for targeted outreach.`,
  };
}

export async function analyzeProfile(
  input: ProfileInput,
): Promise<ProfileIntelligence> {
  const key = brainKey([
    "profile-intel",
    input.name,
    input.headline,
    input.summary?.slice(0, 200),
    input.skills.join(","),
    input.experience.length,
    input.education.length,
  ]);
  return brainOnce(key, async () => {
    try {
      const { data } = await brainJson<ProfileIntelligence>({
        system:
          "You are Imperium Brain — a senior career strategist. Output STRICT JSON only.",
        user: `Analyse this candidate. Return JSON with keys:
strengths (string[]), weaknesses (string[]), skill_gaps (string[]),
recommended_roles (string[]), recommended_industries (string[]),
ats_score (number 0-100), competitive_position (string),
growth_opportunities (string[]), summary (string under 280 chars).

Candidate:
Name: ${input.name}
Headline: ${input.headline ?? "—"}
Summary: ${input.summary ?? "—"}
Skills: ${input.skills.join(", ") || "—"}
Experience entries: ${input.experience.length}
Education entries: ${input.education.length}
LinkedIn: ${input.linkedin_url ?? "—"}
GitHub: ${input.github_url ?? "—"}
Portfolio: ${input.portfolio_url ?? "—"}
Target roles: ${(input.target_roles ?? []).join(", ") || "—"}`,
        temperature: 0.3,
        max_tokens: 900,
      });
      if (data && typeof data.ats_score === "number") return data;
    } catch {
      // fall through to heuristic
    }
    return fallback(input);
  });
}
