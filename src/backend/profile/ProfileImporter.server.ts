/**
 * Profile importers — extract a structured ImperiumProfile patch from
 * raw text (resume) or a LinkedIn URL (via Firecrawl scrape).
 *
 * Server-only. Uses the existing OpenRouter brain router for LLM extraction.
 */

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
    gpa?: string;
  }[];
  projects?: { name: string; description?: string; stack?: string[]; url?: string; highlights?: string[] }[];
  certifications?: { name: string; issuer?: string; year?: string }[];
  languages?: { name: string; proficiency?: string }[];
  achievements?: string[];
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
        gpa: str(e.gpa),
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
        highlights: strArr(e.highlights),
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

const SECTION_RE = /^(profile summary|summary|objective|skills|technical skills|education|projects|academic projects|experience|work experience|certifications|achievements|languages)\b[:\s-]*$/i;

function sectionText(lines: string[], names: string[]): string {
  const wanted = new Set(names.map((n) => n.toLowerCase()));
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const key = lines[i].replace(/[:\s-]+$/g, "").toLowerCase();
    if (wanted.has(key)) {
      start = i + 1;
      break;
    }
  }
  if (start < 0) return "";
  const out: string[] = [];
  for (let i = start; i < lines.length; i++) {
    if (SECTION_RE.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join("\n").trim();
}

function cleanListItem(line: string): string {
  return line.replace(/^[•*\-–—\d.)\s]+/, "").replace(/\s+/g, " ").trim();
}

function parseSkills(text: string): string[] {
  const known = [
    "Python", "JavaScript", "TypeScript", "Java", "React", "React.js", "Next.js", "Node.js", "Express.js",
    "HTML", "HTML5", "CSS", "CSS3", "Tailwind CSS", "PostgreSQL", "MySQL", "MongoDB", "SQL", "REST APIs",
    "Git", "GitHub", "Docker", "Postman", "VS Code", "Data Structures", "Algorithms", "OOP", "AI", "Machine Learning",
  ];
  const lower = text.toLowerCase();
  const detected = known.filter((skill) => lower.includes(skill.toLowerCase()));
  const explicit = text
    .split(/[,•|;\n]/)
    .map(cleanListItem)
    .filter((s) => /^[A-Za-z][A-Za-z0-9+#./ -]{1,32}$/.test(s));
  return Array.from(new Set([...detected, ...explicit])).slice(0, 40);
}

function parseEducation(block: string): ProfilePatch["education"] {
  if (!block) return [];
  return block
    .split(/\n+/)
    .map(cleanListItem)
    .filter((l) => l.length > 4)
    .slice(0, 6)
    .map((line) => {
      const gpa = line.match(/(?:cgpa|gpa|percentage)[:\s-]*([0-9.]+\/?10|[0-9.]+%)/i)?.[1];
      const years = line.match(/(20\d{2}|19\d{2})\s*(?:[-–—]|to)?\s*(20\d{2}|present)?/i);
      const degree = line.match(/\b(MCA|BCA|B\.Tech|BTech|M\.Tech|MTech|BSc|B\.Sc|Bachelor[^,|–—]*|Master[^,|–—]*|Intermediate|Diploma)\b/i)?.[0];
      const school = line
        .replace(/\b(CGPA|GPA|Percentage)[:\s-]*[0-9.]+\/?10|[0-9.]+%/gi, "")
        .replace(/20\d{2}\s*(?:[-–—]|to)?\s*(20\d{2}|present)?/gi, "")
        .replace(degree ?? "", "")
        .replace(/[|,–—-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return { school: school || line, degree: degree || undefined, start: years?.[1], end: years?.[2], field: "", gpa: gpa || undefined };
    });
}

function parseProjects(block: string): ProfilePatch["projects"] {
  if (!block) return [];
  const rawLines = block.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const chunks: string[][] = [];
  let current: string[] = [];
  for (const raw of rawLines) {
    const isBullet = /^[•*\-–—]\s+/.test(raw);
    const cleaned = cleanListItem(raw);
    const looksLikeTitle = !isBullet && cleaned.length <= 90 && !/[.!?]$/.test(cleaned);
    if (looksLikeTitle && current.length) {
      chunks.push(current);
      current = [cleaned];
    } else {
      current.push(cleaned);
    }
  }
  if (current.length) chunks.push(current);
  return chunks.slice(0, 8).map((lines) => {
    const first = lines[0] ?? "Project";
    const [namePart, ...restParts] = first.split(/\s+[|:–—-]\s+/);
    const detailLines = [restParts.join(" "), ...lines.slice(1)].filter(Boolean);
    const chunk = lines.join("\n");
    const stack = parseSkills(chunk).slice(0, 8);
    const url = chunk.match(/https?:\/\/[^\s)]+/i)?.[0];
    const highlights = detailLines.filter((l) => l.length > 20).slice(0, 4);
    return { name: namePart.trim() || first, description: detailLines.join(" ").slice(0, 260), stack, url, ...(highlights.length ? { highlights } : {}) };
  }).filter((p) => p.name.length > 2);
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
  const lines = cleaned.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const email = cleaned.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  const phoneLine = lines.find((l) => /phone|mobile|contact|^\+?\d[\d\s().-]{7,}\d$/i.test(l) && !/cgpa|gpa|percentage|20\d{2}/i.test(l)) ?? "";
  const phone = phoneLine.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0]?.trim() ?? "";
  const linkedin = cleaned.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[^\s)]+/i)?.[0] ?? "";
  const github = cleaned.match(/https?:\/\/(?:www\.)?github\.com\/[^\s)]+/i)?.[0] ?? "";
  const summaryBlock = sectionText(lines, ["profile summary", "summary", "objective"]);
  const skillsSource = sectionText(lines, ["skills", "technical skills"]) || cleaned;
  const educationBlock = sectionText(lines, ["education"]);
  const projectsBlock = sectionText(lines, ["projects", "academic projects"]);
  const skills = parseSkills(skillsSource);
  const firstContentLine = lines.find((l) => !l.includes("@") && !/^https?:\/\//i.test(l) && l.length <= 80) ?? "";
  const headline = lines.find((l) => !/^[•*\-–—]/.test(l) && /\b(engineer|developer|manager|designer|analyst|architect|consultant)\b/i.test(l)) ?? "";
  return {
    patch: sanitizePatch({
      name: firstContentLine,
      email,
      phone,
      headline,
      target_role: headline,
      summary: (summaryBlock || headline).replace(/\s+/g, " ").slice(0, 700),
      linkedin_url: linkedin,
      github_url: github,
      skills,
      education: parseEducation(educationBlock),
      projects: parseProjects(projectsBlock),
    }),
    model: "local-parser",
  };
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
