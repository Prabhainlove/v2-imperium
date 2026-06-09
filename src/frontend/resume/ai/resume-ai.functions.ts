/**
 * AI server functions for Resume Studio. Local-first: routes through
 * ModelRouter, which prefers Ollama (Qwen3:8B) when configured, then
 * falls back to OpenRouter / OpenAI / Anthropic. Returns small,
 * deterministic JSON shapes safe to merge into ResumeJSON.
 */
import { createServerFn } from "@tanstack/react-start";
import { routeBrainCall } from "@backend/ai/ModelRouter.server";

interface ResumeContext {
  name: string;
  title: string;
  summary: string;
  skills: string[];
  experienceSnippets: string[];
  projectSnippets: string[];
}

function safeParse<T>(text: string, fallback: T): T {
  try {
    // tolerate ```json ... ``` fenced output
    const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

/** Generate a 2–3 sentence professional summary. */
export const aiGenerateSummary = createServerFn({ method: "POST" })
  .inputValidator((data: { resume: ResumeContext; jd?: string }) => data)
  .handler(async ({ data }) => {
    const sys =
      "You write concise, ATS-friendly resume summaries. Output ONLY a JSON object {\"summary\": string}. Two to three sentences, max 60 words, no fluff, no first person.";
    const user = JSON.stringify({
      role: data.resume.title || "Candidate",
      skills: data.resume.skills.slice(0, 12),
      recent: data.resume.experienceSnippets.slice(0, 3),
      projects: data.resume.projectSnippets.slice(0, 2),
      jd: data.jd?.slice(0, 1200) ?? "",
    });
    const result = await routeBrainCall({ system: sys, user, json: true, max_tokens: 400 });
    const parsed = safeParse<{ summary?: string }>(result.content, {});
    return {
      summary: parsed.summary ?? "",
      model: result.model,
    };
  });

/** Rewrite a bullet to start with an action verb and include a metric where reasonable. */
export const aiImproveBullet = createServerFn({ method: "POST" })
  .inputValidator((data: { bullet: string; jd?: string }) => data)
  .handler(async ({ data }) => {
    const sys =
      "Rewrite the resume bullet. Start with a strong action verb, keep it 14–30 words, integrate a measurable outcome when one is implied (do not invent numbers). Output ONLY {\"bullet\": string}.";
    const user = JSON.stringify({ bullet: data.bullet, jd: data.jd?.slice(0, 800) ?? "" });
    const result = await routeBrainCall({ system: sys, user, json: true, max_tokens: 250 });
    const parsed = safeParse<{ bullet?: string }>(result.content, {});
    return { bullet: parsed.bullet ?? data.bullet, model: result.model };
  });

/** Suggest missing fields the resume lacks for the given JD. */
export const aiFillMissing = createServerFn({ method: "POST" })
  .inputValidator((data: { resume: ResumeContext; jd?: string }) => data)
  .handler(async ({ data }) => {
    const sys =
      "You analyze a resume against a job description. Output ONLY JSON: {\"missingSkills\": string[], \"missingSections\": string[], \"suggestedBullets\": string[]}. Keep suggestedBullets generic-true, never fabricate employer-specific facts.";
    const user = JSON.stringify({
      resume: data.resume,
      jd: data.jd?.slice(0, 1500) ?? "",
    });
    const result = await routeBrainCall({ system: sys, user, json: true, max_tokens: 700 });
    const parsed = safeParse<{ missingSkills?: string[]; missingSections?: string[]; suggestedBullets?: string[] }>(
      result.content, {},
    );
    return {
      missingSkills: parsed.missingSkills ?? [],
      missingSections: parsed.missingSections ?? [],
      suggestedBullets: parsed.suggestedBullets ?? [],
      model: result.model,
    };
  });

/** Extract structured intent from a job description. */
export const aiAnalyzeJd = createServerFn({ method: "POST" })
  .inputValidator((data: { jd: string }) => data)
  .handler(async ({ data }) => {
    const sys =
      "Extract JD signals. Output ONLY JSON: {\"requiredSkills\": string[], \"keywords\": string[], \"technologies\": string[], \"softSkills\": string[], \"responsibilities\": string[]}. Max 12 items per array. Lowercase.";
    const result = await routeBrainCall({
      system: sys,
      user: data.jd.slice(0, 2500),
      json: true,
      max_tokens: 600,
    });
    const parsed = safeParse<{
      requiredSkills?: string[];
      keywords?: string[];
      technologies?: string[];
      softSkills?: string[];
      responsibilities?: string[];
    }>(result.content, {});
    return {
      requiredSkills: parsed.requiredSkills ?? [],
      keywords: parsed.keywords ?? [],
      technologies: parsed.technologies ?? [],
      softSkills: parsed.softSkills ?? [],
      responsibilities: parsed.responsibilities ?? [],
      model: result.model,
    };
  });
