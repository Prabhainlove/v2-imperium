/**
 * Imperium Brain — Resume optimizer.
 * Produces an ATS-tailored resume in markdown plus before/after ATS scoring
 * and an improvement summary. Always falls back to a deterministic skeleton.
 */
import { brainJson, brainText } from "./reasoning.server";
import { brainKey, brainOnce } from "./memory.server";
import type { ResumeOptimization } from "./types";

export interface ResumeOptimizeInput {
  candidate_name: string;
  candidate_email: string;
  candidate_phone: string;
  candidate_summary?: string;
  candidate_skills: string[];
  candidate_experience: string;
  job_title: string;
  company: string;
  job_description: string;
  job_tech_stack: string[];
  matched_skills: string[];
  missing_skills: string[];
  current_resume_md?: string;
  template?: "classic" | "modern" | "compact";
}

function atsHeuristic(md: string, keywords: string[]): number {
  if (!md.trim()) return 30;
  const lower = md.toLowerCase();
  let hits = 0;
  for (const k of keywords) {
    if (!k) continue;
    if (lower.includes(k.toLowerCase())) hits++;
  }
  const kw = keywords.length ? hits / keywords.length : 0.5;
  const hasSections = /##\s*(summary|experience|skills|education)/i.test(md) ? 1 : 0.6;
  const cleanFormat = /\|/.test(md) ? 0.8 : 1;
  const score = Math.min(100, Math.round((kw * 0.6 + hasSections * 0.3 + cleanFormat * 0.1) * 100));
  return score;
}

function skeletonResume(input: ResumeOptimizeInput): string {
  return [
    `# ${input.candidate_name}`,
    `${input.candidate_email} · ${input.candidate_phone}`,
    "",
    `## Summary`,
    `${
      input.candidate_summary ??
      `${input.candidate_experience} of experience targeting ${input.job_title} roles.`
    }`,
    "",
    `## Core Skills`,
    (input.matched_skills.length ? input.matched_skills : input.candidate_skills).join(" · "),
    "",
    `## Highlights`,
    `- Built and shipped systems aligned with ${input.job_title} at ${input.company}.`,
    `- Strong with ${input.candidate_skills.slice(0, 5).join(", ")}.`,
    `- Comfortable in distributed, async, high-ownership environments.`,
  ].join("\n");
}

export async function optimizeResume(
  input: ResumeOptimizeInput,
): Promise<ResumeOptimization> {
  const keywords = [...new Set([...input.job_tech_stack, ...input.matched_skills, ...input.missing_skills])];
  const key = brainKey([
    "resume-opt",
    input.candidate_name,
    input.job_title,
    input.company,
    input.matched_skills.join(","),
    input.missing_skills.join(","),
    input.template ?? "classic",
    (input.current_resume_md ?? "").slice(0, 200),
  ]);
  return brainOnce(key, async () => {
    const before = atsHeuristic(input.current_resume_md ?? "", keywords);
    let optimized_md = "";
    try {
      optimized_md = await brainText({
        system:
          "You are Imperium Brain — an ATS resume specialist. Output ONLY markdown for a 1-page resume. No commentary. Use # Name on line 1, contact on line 2, then ## sections. No tables, no emojis.",
        user: `Tailor this resume for the target role. Weave in the missing keywords naturally where defensible; do not fabricate experience.

Candidate: ${input.candidate_name}
Email: ${input.candidate_email}
Phone: ${input.candidate_phone}
Experience: ${input.candidate_experience}
Skills: ${input.candidate_skills.join(", ")}
Summary: ${input.candidate_summary ?? ""}

Target role: ${input.job_title} @ ${input.company}
Tech stack: ${input.job_tech_stack.join(", ")}
Matched skills: ${input.matched_skills.join(", ")}
Bridgeable missing skills: ${input.missing_skills.slice(0, 8).join(", ")}
Template: ${input.template ?? "classic"}

Current resume (may be empty):
${input.current_resume_md ?? ""}`,
        temperature: 0.4,
        max_tokens: 1200,
      });
    } catch {
      optimized_md = skeletonResume(input);
    }
    if (!optimized_md.trim()) optimized_md = skeletonResume(input);

    const after = atsHeuristic(optimized_md, keywords);

    // Improvements summary (best-effort, never blocks the resume)
    let improvements: string[] = [];
    let added_keywords: string[] = [];
    let reasoning = "Optimized for target role and ATS keyword coverage.";
    try {
      const { data } = await brainJson<{
        improvements: string[];
        added_keywords: string[];
        reasoning: string;
      }>({
        system: "You are Imperium Brain — resume diff analyst. Output STRICT JSON only.",
        user: `Compare BEFORE and AFTER resumes. Return JSON keys:
improvements (string[] of concrete edits), added_keywords (string[]), reasoning (string under 200 chars).

BEFORE:
${(input.current_resume_md ?? "").slice(0, 1500)}

AFTER:
${optimized_md.slice(0, 1500)}`,
        temperature: 0.2,
        max_tokens: 500,
      });
      if (data) {
        improvements = data.improvements ?? [];
        added_keywords = data.added_keywords ?? [];
        reasoning = data.reasoning ?? reasoning;
      }
    } catch {
      // ignore
    }

    return {
      optimized_md,
      ats_score_before: before,
      ats_score_after: after,
      improvements,
      added_keywords,
      reasoning,
    };
  });
}
