/**
 * Imperium Brain — Resume optimizer.
 * Profile-first, JD-adaptive. The profile is the source of truth; the JD
 * Analysis engine drives ordering, summary, and ATS scoring.
 */
import { brainKey, brainOnce } from "@backend/ai/PromptMemory.server";
import type { ResumeOptimization } from "@backend/ai/AiTypes";
import {
  buildAgentContext,
  type AgentContext,
} from "@backend/profile/AgentContextBuilder";
import { buildResumeFromProfile } from "@backend/profile/ProfileTextGenerators";
import { analyzeJobDescription } from "@backend/profile/JobDescriptionLocalAnalysis";
import { calculateATSMatch } from "@backend/profile/AtsScorer";
import { runQualityGate } from "@backend/profile/ProfileQualityGate";
import { validateProfileLinks } from "@backend/profile/LinkValidator";
import type { ImperiumProfile } from "@backend/profile/ProfileTypes";

export interface ResumeOptimizeInput {
  profile: Partial<ImperiumProfile>;
  job_title: string;
  company: string;
  job_description: string;
  job_tech_stack: string[];
  current_resume_md?: string;
  template?: "jake-ats" | "classic" | "modern" | "compact";
}

function priorAtsScore(md: string, keywords: string[]): number {
  if (!md.trim()) return 30;
  const lower = md.toLowerCase();
  let hits = 0;
  for (const k of keywords) if (k && lower.includes(k.toLowerCase())) hits++;
  const kw = keywords.length ? hits / keywords.length : 0.5;
  const hasSections = /##\s*(summary|experience|skills|projects|education)/i.test(md) ? 1 : 0.6;
  return Math.min(100, Math.round((kw * 0.6 + hasSections * 0.4) * 100));
}

export async function optimizeResume(
  input: ResumeOptimizeInput,
): Promise<ResumeOptimization> {
  const ctx: AgentContext = buildAgentContext(input.profile);
  const jd = analyzeJobDescription({
    title: input.job_title,
    company: input.company,
    description: input.job_description,
    tech_stack: input.job_tech_stack,
  });

  const key = brainKey([
    "resume-opt-v3",
    ctx.personal.name,
    input.job_title,
    input.company,
    jd.primaryRole,
    jd.primaryKeywords.join(","),
    ctx.skills.join(","),
    ctx.projects.map((p) => p.name).join(","),
    input.template ?? "jake-ats",
  ]);

  return brainOnce(key, async () => {
    const before = priorAtsScore(input.current_resume_md ?? "", input.job_tech_stack);

    const optimized_md = buildResumeFromProfile(ctx, {
      title: input.job_title,
      company: input.company,
      description: input.job_description,
      tech_stack: input.job_tech_stack,
    });

    const ats = calculateATSMatch(optimized_md, jd, ctx);
    const gate = runQualityGate(optimized_md);
    const links = validateProfileLinks({
      linkedin_url: input.profile.linkedin_url,
      github_url: input.profile.github_url,
      portfolio_url: input.profile.portfolio_url,
    });

    const improvements: string[] = [
      `Detected role: ${jd.primaryRole} (confidence ${(jd.confidence * 100).toFixed(0)}%).`,
      `Rebuilt from profile: ${ctx.projects.length} projects, ${ctx.experience.length} roles, ${ctx.education.length} education entries.`,
      ctx.is_fresher
        ? "Fresher mode — projects placed before experience as primary evidence."
        : "Experience section leads with profile-verified roles.",
      ats.matchedSkills.length
        ? `JD-aligned skills surfaced: ${ats.matchedSkills.slice(0, 6).join(", ")}.`
        : "No direct JD overlap surfaced — review profile skill ordering.",
      ats.underutilizedSkills.length
        ? `In your profile but not on this resume: ${ats.underutilizedSkills.slice(0, 4).join(", ")} — consider a project bullet.`
        : "All profile-side JD matches are on the resume.",
      ats.missingSkills.length
        ? `Missing from profile (not added — would be fabrication): ${ats.missingSkills.slice(0, 5).join(", ")}.`
        : "All JD-required skills are supported by profile.",
      ...ats.recommendations,
    ];

    return {
      optimized_md,
      ats_score_before: before,
      ats_score_after: ats.atsScore,
      improvements,
      added_keywords: ats.matchedSkills,
      reasoning: gate.pass
        ? `Profile-first generation, JD-adaptive. Quality gate passed for ${jd.primaryRole}.`
        : `Profile-first generation. Quality gate flagged: ${gate.failures.join(" | ")}`,
      ats_report: {
        ats_score: ats.atsScore,
        keyword_coverage: ats.keywordCoverage,
        matched_skills: ats.matchedSkills,
        missing_skills: ats.missingSkills,
        underutilized_skills: ats.underutilizedSkills,
        recommendations: ats.recommendations,
        resume_gaps: ats.resumeGaps,
        primary_role: jd.primaryRole,
        link_warnings: links.warnings,
      },
      quality_warnings: [...gate.failures, ...gate.warnings],
    };
  });
}
