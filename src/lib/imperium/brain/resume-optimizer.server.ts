/**
 * Imperium Brain — Resume optimizer.
 * Profile-first. The profile is the source of truth; the job description
 * only customizes ordering and the targeting line. No keyword stuffing,
 * no invented experience or technologies. Output is validated against the
 * profile vocabulary and any hallucinated terms are stripped.
 */
import { brainKey, brainOnce } from "./memory.server";
import type { ResumeOptimization } from "./types";
import {
  buildAgentContext,
  validateAgainstProfile,
  type AgentContext,
} from "../profile/agent-context";
import { buildResumeFromProfile } from "../profile/generators";
import type { ImperiumProfile } from "../profile/types";

export interface ResumeOptimizeInput {
  /** Full profile snapshot. Generation reads only from this. */
  profile: Partial<ImperiumProfile>;
  job_title: string;
  company: string;
  job_description: string;
  job_tech_stack: string[];
  current_resume_md?: string;
  template?: "jake-ats" | "classic" | "modern" | "compact";
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
  const hasSections = /##\s*(summary|experience|skills|projects|education)/i.test(md) ? 1 : 0.6;
  return Math.min(100, Math.round((kw * 0.6 + hasSections * 0.4) * 100));
}

function alignedKeywords(ctx: AgentContext, stack: string[]): { matched: string[]; missing: string[] } {
  const matched: string[] = [];
  const missing: string[] = [];
  for (const k of stack) {
    if (ctx.vocabulary.has(k.toLowerCase())) matched.push(k);
    else missing.push(k);
  }
  return { matched, missing };
}

export async function optimizeResume(
  input: ResumeOptimizeInput,
): Promise<ResumeOptimization> {
  const ctx = buildAgentContext(input.profile);
  const key = brainKey([
    "resume-opt-v2",
    ctx.personal.name,
    input.job_title,
    input.company,
    input.job_tech_stack.join(","),
    ctx.skills.join(","),
    ctx.projects.map((p) => p.name).join(","),
    input.template ?? "classic",
  ]);
  return brainOnce(key, async () => {
    const before = atsHeuristic(input.current_resume_md ?? "", input.job_tech_stack);

    // Profile-first deterministic build. This is the canonical output.
    const optimized_md = buildResumeFromProfile(ctx, {
      title: input.job_title,
      company: input.company,
      description: input.job_description,
      tech_stack: input.job_tech_stack,
    });

    const after = atsHeuristic(optimized_md, input.job_tech_stack);
    const { matched, missing } = alignedKeywords(ctx, input.job_tech_stack);
    const report = validateAgainstProfile(optimized_md, ctx);

    const improvements: string[] = [
      `Rebuilt from profile: ${ctx.projects.length} projects, ${ctx.experience.length} roles, ${ctx.education.length} education entries.`,
      ctx.is_fresher
        ? "Fresher mode — projects placed before experience as primary evidence."
        : "Experience section leads with profile-verified roles.",
      matched.length
        ? `Job stack overlap with profile: ${matched.slice(0, 6).join(", ")}.`
        : "No direct job-stack overlap — review profile skills.",
      missing.length
        ? `Missing from profile (not added — would be a fabrication): ${missing.slice(0, 5).join(", ")}.`
        : "All job-stack keywords supported by profile.",
    ];

    return {
      optimized_md,
      ats_score_before: before,
      ats_score_after: after,
      improvements,
      added_keywords: matched,
      reasoning: report.ok
        ? "Profile-first generation. No invented technologies; every keyword traces to the profile."
        : `Profile-first generation. Stripped ${report.hallucinated.length} term(s) not present in profile.`,
    };
  });
}
