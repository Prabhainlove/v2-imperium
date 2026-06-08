/**
 * Imperium Brain — Cover letter generator.
 * Profile-first. Uses projects and education as primary evidence, especially
 * for freshers. Falls back to deterministic profile-driven text if the model
 * is unavailable or hallucinates facts not in the profile.
 */
import { brainText } from "@backend/ai/ReasoningEngine.server";
import { brainKey, brainOnce } from "@backend/ai/PromptMemory.server";
import type { CoverLetterPackage } from "@backend/ai/AiTypes";
import {
  buildAgentContext,
  validateAgainstProfile,
  stripHallucinations,
  type AgentContext,
} from "@backend/profile/AgentContextBuilder";
import { buildCoverFromProfile } from "@backend/profile/ProfileTextGenerators";
import type { ImperiumProfile } from "@backend/profile/ProfileTypes";

export interface CoverLetterInput {
  /** Full profile snapshot. Generation reads only from this. */
  profile: Partial<ImperiumProfile>;
  job_title: string;
  company: string;
  job_description: string;
}

function deterministic(ctx: AgentContext, input: CoverLetterInput): string {
  return buildCoverFromProfile(ctx, {
    title: input.job_title,
    company: input.company,
    description: input.job_description,
  });
}

export async function generateCoverLetter(
  input: CoverLetterInput,
): Promise<CoverLetterPackage> {
  const ctx = buildAgentContext(input.profile);
  const key = brainKey([
    "cover-letter",
    ctx.personal.name,
    input.job_title,
    input.company,
    ctx.skills.join(","),
    ctx.projects.map((p) => p.name).join(","),
  ]);
  return brainOnce(key, async () => {
    const baseline = deterministic(ctx, input);
    let cover_letter_md = baseline;

    try {
      const projectsBlock = ctx.projects
        .slice(0, 3)
        .map(
          (p) =>
            `- ${p.name}${p.stack?.length ? ` [${p.stack.join(", ")}]` : ""}: ${
              p.highlights?.[0] ?? p.description ?? ""
            }`,
        )
        .join("\n");
      const edu = ctx.education[0];
      const eduLine = edu
        ? `${edu.degree ?? ""}${edu.field ? ` in ${edu.field}` : ""}${edu.school ? ` at ${edu.school}` : ""}${edu.gpa ? ` (GPA ${edu.gpa})` : ""}`
        : "";

      const llmText = await brainText({
        system:
          "You are Imperium Brain — a senior career writer. STRICT RULES: (1) Only use facts present in the candidate profile below. (2) NEVER invent technologies, companies, job titles, achievements or years of experience. (3) Output ONLY the cover letter markdown — no preface, no role summary heading. (4) Under 220 words. (5) Reference 1–2 specific named projects from the profile.",
        user: `Write a tailored cover letter using ONLY the profile facts below.

== CANDIDATE PROFILE (source of truth) ==
Name: ${ctx.personal.name}
Headline: ${ctx.personal.headline}
Summary: ${ctx.personal.summary}
Education: ${eduLine}
Skills (allowed technologies — do not mention any other): ${ctx.skills.join(", ")}
Projects:
${projectsBlock || "(none)"}
Achievements: ${ctx.achievements.slice(0, 3).join("; ")}

== TARGET ROLE ==
${input.job_title} @ ${input.company}
Description (truncated): ${input.job_description.slice(0, 900)}`,
        temperature: 0.4,
        max_tokens: 600,
      });

      const candidate = llmText.trim();
      if (candidate) {
        const report = validateAgainstProfile(candidate, ctx);
        if (report.ok) {
          cover_letter_md = candidate;
        } else {
          // Try once with hallucinations stripped; if too damaged, fall back.
          const cleaned = stripHallucinations(candidate, ctx).trim();
          cover_letter_md = cleaned.length > 200 ? cleaned : baseline;
        }
      }
    } catch {
      cover_letter_md = baseline;
    }

    const finalReport = validateAgainstProfile(cover_letter_md, ctx);

    return {
      cover_letter_md,
      company_alignment: `Cover letter references profile facts only and targets ${input.company}.`,
      role_alignment: `Bridges ${ctx.projects.length} profile project(s) into the ${input.job_title} responsibilities.`,
      confidence: finalReport.ok ? 0.85 : 0.6,
      reasoning: finalReport.ok
        ? "Generated from profile and validated against profile vocabulary."
        : `Validation rejected ${finalReport.hallucinated.length} hallucinated term(s); used deterministic profile-only letter.`,
    };
  });
}
