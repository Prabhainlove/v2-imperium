/**
 * Imperium Intelligence Engine — server-only.
 *
 * Self-thinking reasoning layer powered by Lovable AI Gateway with automatic
 * model fallback. Returns structured JSON + a stream of "thinking" steps that
 * the UI renders to make the AI's reasoning visible.
 */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Primary -> fallbacks. All routed through Lovable AI Gateway.
const MODEL_CHAIN = [
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-flash",
  "openai/gpt-5-mini",
  "openai/gpt-5-nano",
] as const;

export type ThinkingStep = {
  id: string;
  label: string;
  detail?: string;
  status: "running" | "done" | "failed";
  ts: number;
};

export type Emit = (step: Partial<ThinkingStep> & { label: string }) => void;

async function callGatewayOnce(
  model: string,
  system: string,
  user: string,
  jsonMode: boolean,
): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  if (jsonMode) body.response_format = { type: "json_object" };

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "imperium-intelligence",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`gateway ${res.status} (${model}): ${text.slice(0, 240)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`empty completion from ${model}`);
  return content;
}

export async function think(
  system: string,
  user: string,
  opts: { json?: boolean; emit?: Emit } = {},
): Promise<{ text: string; model: string }> {
  let lastErr: unknown = null;
  for (const model of MODEL_CHAIN) {
    try {
      opts.emit?.({
        label: "Routing to model",
        detail: model,
        status: "running",
      });
      const text = await callGatewayOnce(
        model,
        system,
        user,
        opts.json ?? false,
      );
      opts.emit?.({
        label: "Model responded",
        detail: model,
        status: "done",
      });
      return { text, model };
    } catch (err) {
      lastErr = err;
      opts.emit?.({
        label: "Model failed — trying fallback",
        detail: `${model}: ${(err as Error).message.slice(0, 120)}`,
        status: "failed",
      });
    }
  }
  throw new Error(
    `All models failed. Last error: ${(lastErr as Error)?.message ?? "unknown"}`,
  );
}

function safeJson<T>(text: string, fallback: T): T {
  const t = text.trim();
  // Strip code fences if present
  const cleaned = t
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Try to locate the first {...} block
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as T;
      } catch {
        /* fall through */
      }
    }
    return fallback;
  }
}

/* ---------- High-level reasoning operations ---------- */

export type CandidateProfileAnalysis = {
  strengths: string[];
  weaknesses: string[];
  missing_skills: string[];
  recommended_roles: string[];
  recommended_paths: string[];
  seniority: "junior" | "mid" | "senior" | "lead" | "principal" | "unknown";
  positioning: string;
  confidence: number;
};

export async function analyzeCandidate(
  input: {
    name?: string;
    headline?: string;
    summary?: string;
    skills?: string[];
    experience?: unknown[];
    education?: unknown[];
    linkedin_url?: string;
    github_url?: string;
    portfolio_url?: string;
  },
  emit?: Emit,
): Promise<CandidateProfileAnalysis> {
  emit?.({ label: "Analyzing candidate profile", status: "running" });
  const sys =
    "You are Imperium, a senior career strategist. Analyze the candidate and return ONLY JSON matching this schema: { strengths:string[], weaknesses:string[], missing_skills:string[], recommended_roles:string[], recommended_paths:string[], seniority:'junior'|'mid'|'senior'|'lead'|'principal'|'unknown', positioning:string, confidence:number }. Be specific, actionable, no fluff.";
  const user = JSON.stringify(input);
  const { text } = await think(sys, user, { json: true, emit });
  const out = safeJson<CandidateProfileAnalysis>(text, {
    strengths: [],
    weaknesses: [],
    missing_skills: [],
    recommended_roles: [],
    recommended_paths: [],
    seniority: "unknown",
    positioning: "",
    confidence: 0,
  });
  emit?.({ label: "Candidate profile understood", status: "done" });
  return out;
}

export type JobAnalysis = {
  match_score: number;
  matched_skills: string[];
  missing_skills: string[];
  experience_fit: number;
  resume_recommendations: string[];
  application_recommendations: string[];
  verdict: "strong" | "good" | "weak" | "skip";
  reasoning: string;
};

export async function analyzeJob(
  candidate: { skills?: string[]; headline?: string; summary?: string; experience?: unknown[] },
  job: { title: string; company: string; description?: string; tech_stack?: string[] },
  emit?: Emit,
): Promise<JobAnalysis> {
  emit?.({ label: `Analyzing role: ${job.title} @ ${job.company}`, status: "running" });
  const sys =
    "You are Imperium, a job-match strategist. Score fit and return ONLY JSON: { match_score:0..1, matched_skills:string[], missing_skills:string[], experience_fit:0..1, resume_recommendations:string[], application_recommendations:string[], verdict:'strong'|'good'|'weak'|'skip', reasoning:string }.";
  const user = JSON.stringify({ candidate, job });
  const { text } = await think(sys, user, { json: true, emit });
  const out = safeJson<JobAnalysis>(text, {
    match_score: 0,
    matched_skills: [],
    missing_skills: [],
    experience_fit: 0,
    resume_recommendations: [],
    application_recommendations: [],
    verdict: "weak",
    reasoning: "Unable to parse model output.",
  });
  emit?.({
    label: `Match score: ${(out.match_score * 100).toFixed(0)}% — ${out.verdict}`,
    status: "done",
  });
  return out;
}

export type ResumeOptimization = {
  optimized_md: string;
  ats_score: number;
  added_keywords: string[];
  missing_keywords: string[];
  changes: string[];
};

export async function optimizeResume(
  resume_md: string,
  job: { title: string; company: string; description?: string; tech_stack?: string[] },
  emit?: Emit,
): Promise<ResumeOptimization> {
  emit?.({ label: "Optimizing resume for target role", status: "running" });
  const sys = `You are Imperium, an ATS-aware resume rewriter. Rewrite the candidate's resume in clean Markdown, targeted to the specific job. Strengthen bullets with metrics where plausible (do not fabricate companies/dates), naturally weave in the job's keywords, and keep it under one page worth of content. Return ONLY JSON: { optimized_md:string, ats_score:0..1, added_keywords:string[], missing_keywords:string[], changes:string[] }.`;
  const user = JSON.stringify({ resume_md, job });
  const { text } = await think(sys, user, { json: true, emit });
  const out = safeJson<ResumeOptimization>(text, {
    optimized_md: resume_md,
    ats_score: 0,
    added_keywords: [],
    missing_keywords: [],
    changes: [],
  });
  emit?.({
    label: `Resume optimized — ATS ${(out.ats_score * 100).toFixed(0)}%`,
    detail: `${out.added_keywords.length} keywords added`,
    status: "done",
  });
  return out;
}

export type CoverLetter = {
  cover_letter_md: string;
  reasoning: {
    why_candidate_fits: string;
    why_role_matches: string;
    strengths_highlighted: string[];
  };
};

export async function generateCoverLetter(
  candidate: { name?: string; headline?: string; summary?: string; skills?: string[] },
  job: { title: string; company: string; description?: string },
  emit?: Emit,
): Promise<CoverLetter> {
  emit?.({ label: "Drafting company-specific cover letter", status: "running" });
  const sys =
    "You are Imperium. Write a concise, confident, company-specific cover letter in Markdown (3 short paragraphs). Return ONLY JSON: { cover_letter_md:string, reasoning:{ why_candidate_fits:string, why_role_matches:string, strengths_highlighted:string[] } }.";
  const user = JSON.stringify({ candidate, job });
  const { text } = await think(sys, user, { json: true, emit });
  const out = safeJson<CoverLetter>(text, {
    cover_letter_md: `Dear ${job.company} team,\n\nI'd like to apply for ${job.title}.\n\nBest,\n${candidate.name ?? "Candidate"}`,
    reasoning: {
      why_candidate_fits: "",
      why_role_matches: "",
      strengths_highlighted: [],
    },
  });
  emit?.({ label: "Cover letter ready", status: "done" });
  return out;
}

export type ApplicationPlan = {
  recommendation: "apply" | "skip";
  confidence: number;
  resume_version: string;
  highlight_projects: string[];
  emphasize_skills: string[];
  summary: string;
};

export async function planApplication(
  inputs: {
    candidate: unknown;
    job: unknown;
    job_analysis: JobAnalysis;
    resume_opt: ResumeOptimization;
  },
  emit?: Emit,
): Promise<ApplicationPlan> {
  emit?.({ label: "Preparing application package", status: "running" });
  const sys =
    "You are Imperium. Decide whether to apply and how to present the candidate. Return ONLY JSON: { recommendation:'apply'|'skip', confidence:0..1, resume_version:string, highlight_projects:string[], emphasize_skills:string[], summary:string }.";
  const user = JSON.stringify(inputs);
  const { text } = await think(sys, user, { json: true, emit });
  const out = safeJson<ApplicationPlan>(text, {
    recommendation: "skip",
    confidence: 0,
    resume_version: "default",
    highlight_projects: [],
    emphasize_skills: [],
    summary: "Unable to plan application.",
  });
  emit?.({
    label: `Recommendation: ${out.recommendation.toUpperCase()} (${(out.confidence * 100).toFixed(0)}%)`,
    status: "done",
  });
  return out;
}
