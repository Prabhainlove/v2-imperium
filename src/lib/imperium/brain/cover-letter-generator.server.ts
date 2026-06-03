/**
 * Imperium Brain — Cover letter generator.
 */
import { brainJson, brainText } from "./reasoning.server";
import { brainKey, brainOnce } from "./memory.server";
import type { CoverLetterPackage } from "./types";

export interface CoverLetterInput {
  candidate_name: string;
  candidate_summary?: string;
  candidate_skills: string[];
  candidate_experience: string;
  job_title: string;
  company: string;
  job_description: string;
}

function fallback(input: CoverLetterInput): string {
  return [
    `Dear ${input.company} hiring team,`,
    "",
    `I'm applying for the ${input.job_title} role. With ${input.candidate_experience} of experience, I bring hands-on expertise in ${input.candidate_skills.slice(0, 4).join(", ")} — directly aligned with what your team is building.`,
    "",
    `I'd welcome the chance to discuss how I can contribute.`,
    "",
    `Best regards,`,
    input.candidate_name,
  ].join("\n");
}

export async function generateCoverLetter(
  input: CoverLetterInput,
): Promise<CoverLetterPackage> {
  const key = brainKey([
    "cover-letter",
    input.candidate_name,
    input.job_title,
    input.company,
    input.candidate_skills.join(","),
  ]);
  return brainOnce(key, async () => {
    let cover_letter_md = "";
    try {
      cover_letter_md = await brainText({
        system:
          "You are Imperium Brain — a senior career writer. Output ONLY the cover letter markdown. Under 220 words. No clichés, no AI-disclosure, no role-summary headers.",
        user: `Write a tailored cover letter.

Candidate: ${input.candidate_name}
Experience: ${input.candidate_experience}
Skills: ${input.candidate_skills.join(", ")}
Summary: ${input.candidate_summary ?? ""}

Role: ${input.job_title} @ ${input.company}
Description (truncated): ${input.job_description.slice(0, 900)}`,
        temperature: 0.5,
        max_tokens: 600,
      });
    } catch {
      cover_letter_md = fallback(input);
    }
    if (!cover_letter_md.trim()) cover_letter_md = fallback(input);

    let pkg: Omit<CoverLetterPackage, "cover_letter_md"> = {
      company_alignment: `Cover letter aligned with ${input.company}'s stated stack.`,
      role_alignment: `Bridges candidate expertise into ${input.job_title} responsibilities.`,
      confidence: 0.75,
      reasoning: "Generated and aligned by Brain.",
    };
    try {
      const { data } = await brainJson<typeof pkg>({
        system: "You are Imperium Brain — alignment analyst. Output STRICT JSON only.",
        user: `Analyse this cover letter. Return JSON keys:
company_alignment (string), role_alignment (string),
confidence (0..1), reasoning (string under 200 chars).

Letter:
${cover_letter_md.slice(0, 1500)}

Role: ${input.job_title} @ ${input.company}`,
        temperature: 0.2,
        max_tokens: 400,
      });
      if (data) pkg = { ...pkg, ...data };
    } catch {
      // keep defaults
    }
    return { cover_letter_md, ...pkg };
  });
}
