/**
 * Profile importers — extract a structured ImperiumProfile patch from
 * raw text (resume) or a LinkedIn URL (via Firecrawl scrape).
 *
 * Server-only. Uses the existing OpenRouter brain router for LLM extraction.
 */
import { routeBrainCall } from "./model-router.server";

export interface ProfilePatch {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  headline?: string;
  summary?: string;
  target_role?: string;
  seniority?: string;
  linkedin_url?: string;
  github_url?: string;
  portfolio_url?: string;
  skills?: string[];
  experience?: {
    title: string;
    company: string;
    location?: string;
    start?: string;
    end?: string;
    description?: string;
  }[];
  education?: {
    school: string;
    degree?: string;
    field?: string;
    start?: string;
    end?: string;
  }[];
  projects?: { name: string; description?: string; stack?: string[]; url?: string }[];
  certifications?: { name: string; issuer?: string; year?: string }[];
  languages?: { name: string; proficiency?: string }[];
  achievements?: string[];
}

const SYSTEM = `You are an expert resume parser. Extract structured candidate information from the provided text.
Return ONLY a single valid JSON object with this exact shape (omit fields you cannot determine, never invent data):

{
  "name": string,
  "email": string,
  "phone": string,
  "location": string,
  "headline": string,                  // short professional headline / current title
  "summary": string,                   // 2-4 sentence professional summary
  "target_role": string,               // best-guess target role from headline / latest title
  "seniority": "Intern"|"Junior"|"Mid"|"Senior"|"Staff"|"Principal"|"Lead"|"Manager"|"Director",
  "linkedin_url": string,
  "github_url": string,
  "portfolio_url": string,
  "skills": string[],                  // unique, normalized (e.g. "TypeScript", "PostgreSQL")
  "experience": [{ "title": string, "company": string, "location": string,
                   "start": "YYYY-MM", "end": "YYYY-MM" | "",
                   "description": string }],
  "education": [{ "school": string, "degree": string, "field": string,
                  "start": "YYYY", "end": "YYYY" }],
  "projects": [{ "name": string, "description": string, "stack": string[], "url": string }],
  "certifications": [{ "name": string, "issuer": string, "year": string }],
  "languages": [{ "name": string, "proficiency": "basic"|"conversational"|"fluent"|"native" }],
  "achievements": string[]
}

Strict rules:
- Output JSON only. No markdown fences, no commentary.
- Use ISO month strings (YYYY-MM) for experience dates; use "" for current end date.
- Deduplicate skills. Prefer canonical names.
- Keep descriptions concise (<= 350 chars), focus on impact and tech.`;

function safeParseJson(raw: string): ProfilePatch {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Model returned non-JSON content");
  const slice = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(slice) as ProfilePatch;
  } catch (err) {
    throw new Error(
      `Failed to parse extraction JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function sanitizePatch(p: ProfilePatch): ProfilePatch {
  const out: ProfilePatch = {};
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const strArr = (v: unknown) =>
    Array.isArray(v)
      ? v.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean)
      : [];

  if (str(p.name)) out.name = str(p.name);
  if (str(p.email)) out.email = str(p.email);
  if (str(p.phone)) out.phone = str(p.phone);
  if (str(p.location)) out.location = str(p.location);
  if (str(p.headline)) out.headline = str(p.headline);
  if (str(p.summary)) out.summary = str(p.summary);
  if (str(p.target_role)) out.target_role = str(p.target_role);
  if (str(p.seniority)) out.seniority = str(p.seniority);
  if (str(p.linkedin_url)) out.linkedin_url = str(p.linkedin_url);
  if (str(p.github_url)) out.github_url = str(p.github_url);
  if (str(p.portfolio_url)) out.portfolio_url = str(p.portfolio_url);
  const skills = strArr(p.skills);
  if (skills.length) out.skills = Array.from(new Set(skills));
  if (Array.isArray(p.experience)) {
    out.experience = p.experience
      .filter((e) => e && (str(e.title) || str(e.company)))
      .map((e) => ({
        title: str(e.title),
        company: str(e.company),
        location: str(e.location),
        start: str(e.start),
        end: str(e.end),
        description: str(e.description),
      }));
  }
  if (Array.isArray(p.education)) {
    out.education = p.education
      .filter((e) => e && str(e.school))
      .map((e) => ({
        school: str(e.school),
        degree: str(e.degree),
        field: str(e.field),
        start: str(e.start),
        end: str(e.end),
      }));
  }
  if (Array.isArray(p.projects)) {
    out.projects = p.projects
      .filter((e) => e && str(e.name))
      .map((e) => ({
        name: str(e.name),
        description: str(e.description),
        stack: strArr(e.stack),
        url: str(e.url),
      }));
  }
  if (Array.isArray(p.certifications)) {
    out.certifications = p.certifications
      .filter((e) => e && str(e.name))
      .map((e) => ({ name: str(e.name), issuer: str(e.issuer), year: str(e.year) }));
  }
  if (Array.isArray(p.languages)) {
    out.languages = p.languages
      .filter((e) => e && str(e.name))
      .map((e) => ({
        name: str(e.name),
        proficiency: str(e.proficiency) || undefined,
      }));
  }
  const ach = strArr(p.achievements);
  if (ach.length) out.achievements = ach;
  return out;
}

/** Extract a profile patch from raw resume text. */
export async function extractProfileFromText(text: string): Promise<{
  patch: ProfilePatch;
  model: string;
}> {
  const cleaned = text.replace(/\u0000/g, "").trim();
  if (cleaned.length < 40) {
    throw new Error(
      "Could not read enough text from the document. Try uploading a different format (PDF, DOCX, or TXT).",
    );
  }
  const truncated = cleaned.length > 18_000 ? cleaned.slice(0, 18_000) : cleaned;
  const result = await routeBrainCall({
    system: SYSTEM,
    user: `Resume text:\n\n${truncated}`,
    temperature: 0.1,
    max_tokens: 2400,
    json: true,
  });
  const patch = sanitizePatch(safeParseJson(result.content));
  return { patch, model: result.model };
}

/**
 * OCR fallback for scanned PDFs was previously implemented via the Lovable AI
 * Gateway. It has been removed for portability. Client-side pdfjs extraction
 * is still attempted first; if it returns too little text, the user is asked
 * to upload a text-based PDF, DOCX, or TXT version of their resume.
 */
export async function extractTextFromPdfBase64(_base64: string): Promise<string> {
  throw new Error(
    "Scanned-PDF OCR is not available in the local build. Please upload a text-based PDF, DOCX, or TXT version of your resume.",
  );
}

/** Extract a profile patch from a base64-encoded PDF (server-side OCR via Gemini). */
export async function extractProfileFromPdfBase64(base64: string): Promise<{
  patch: ProfilePatch;
  model: string;
  source_chars: number;
}> {
  const text = await extractTextFromPdfBase64(base64);
  const result = await extractProfileFromText(text);
  return { patch: result.patch, model: result.model, source_chars: text.length };
}

/** Scrape a LinkedIn profile URL via Firecrawl, then extract a profile patch. */
export async function extractProfileFromLinkedinUrl(url: string): Promise<{
  patch: ProfilePatch;
  model: string;
  source_chars: number;
}> {
  const trimmed = url.trim();
  if (!/^https?:\/\/(www\.)?linkedin\.com\/in\//i.test(trimmed)) {
    throw new Error("Please provide a LinkedIn profile URL like https://www.linkedin.com/in/your-handle");
  }
  const fc = process.env.FIRECRAWL_API_KEY;
  if (!fc) {
    throw new Error(
      "LinkedIn import needs the Firecrawl connector. Connect Firecrawl in Settings → Connectors, then try again.",
    );
  }
  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${fc}`,
    },
    body: JSON.stringify({
      url: trimmed,
      formats: ["markdown"],
      onlyMainContent: true,
      waitFor: 2500,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Firecrawl ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    data?: { markdown?: string };
    markdown?: string;
  };
  const md = (data.data?.markdown ?? data.markdown ?? "").trim();
  if (md.length < 80) {
    throw new Error(
      "LinkedIn returned no readable content. Public access may be blocked — try uploading your resume instead.",
    );
  }
  const result = await extractProfileFromText(md);
  // Ensure the URL is captured.
  if (!result.patch.linkedin_url) result.patch.linkedin_url = trimmed;
  return { patch: result.patch, model: result.model, source_chars: md.length };
}
