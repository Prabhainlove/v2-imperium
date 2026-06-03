/**
 * RenderCV-style resume renderer (server-only, zero deps).
 * Parses a tailored markdown resume into a clean structured HTML document
 * suitable for ATS parsing, print, and PDF export via the browser.
 */

export interface ParsedResume {
  name: string;
  contact: string;
  sections: { heading: string; lines: string[] }[];
}

export function parseResumeMarkdown(md: string): ParsedResume {
  const lines = md.split(/\r?\n/);
  let i = 0;
  // Name: first non-empty line, strip leading '#'
  while (i < lines.length && lines[i].trim() === "") i++;
  const name = (lines[i] ?? "").replace(/^#+\s*/, "").trim() || "Candidate";
  i++;
  // Contact: next non-empty line until first heading
  let contact = "";
  while (i < lines.length && !lines[i].startsWith("#")) {
    const t = lines[i].trim();
    if (t) contact = contact ? `${contact} · ${t}` : t;
    i++;
  }
  const sections: { heading: string; lines: string[] }[] = [];
  let current: { heading: string; lines: string[] } | null = null;
  for (; i < lines.length; i++) {
    const line = lines[i];
    const h = line.match(/^#{2,3}\s+(.*)/);
    if (h) {
      if (current) sections.push(current);
      current = { heading: h[1].trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);
  return { name, contact, sections };
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderLines(lines: string[]): string {
  const out: string[] = [];
  let inUl = false;
  const flush = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (/^[-*•]\s+/.test(line)) {
      if (!inUl) {
        out.push("<ul>");
        inUl = true;
      }
      out.push(`<li>${esc(line.replace(/^[-*•]\s+/, ""))}</li>`);
    } else {
      flush();
      out.push(`<p>${esc(line)}</p>`);
    }
  }
  flush();
  return out.join("");
}

export type ResumeTemplate = "classic" | "modern" | "compact";

const baseCss = `
  *{box-sizing:border-box}
  body{font-family:'Inter','Helvetica Neue',Arial,sans-serif;color:#111;margin:0;padding:32px 40px;line-height:1.45;font-size:11pt;background:#fff}
  h1{font-size:22pt;margin:0 0 4px;letter-spacing:-.01em}
  .contact{color:#444;font-size:10pt;margin-bottom:14px}
  h2{font-size:11pt;text-transform:uppercase;letter-spacing:.08em;border-bottom:1.5px solid #111;padding-bottom:3px;margin:18px 0 8px;color:#111}
  p{margin:4px 0}
  ul{margin:4px 0 8px 18px;padding:0}
  li{margin:2px 0}
  @media print{body{padding:18mm 18mm}}
`;

const modernCss = `
  body{font-family:'Inter',system-ui,sans-serif}
  h1{color:#0b3b8c}
  h2{color:#0b3b8c;border-bottom-color:#0b3b8c}
`;

const compactCss = `
  body{font-size:10pt;padding:24px 32px;line-height:1.35}
  h1{font-size:18pt}
  h2{font-size:10pt;margin:12px 0 4px}
`;

export function renderResumeHtml(md: string, template: ResumeTemplate = "classic"): string {
  const parsed = parseResumeMarkdown(md);
  const css = baseCss + (template === "modern" ? modernCss : template === "compact" ? compactCss : "");
  const body = parsed.sections
    .map((s) => `<section><h2>${esc(s.heading)}</h2>${renderLines(s.lines)}</section>`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(parsed.name)} — Resume</title><style>${css}</style></head><body><header><h1>${esc(parsed.name)}</h1>${parsed.contact ? `<div class="contact">${esc(parsed.contact)}</div>` : ""}</header>${body}</body></html>`;
}

/* ───────── ATS analysis ───────── */
export interface AtsAnalysis {
  score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  added_keywords: string[];
  improvements: string[];
  word_count: number;
}

export function analyzeAts(
  resumeMd: string,
  jobKeywords: string[],
  originalMd?: string,
): AtsAnalysis {
  const text = resumeMd.toLowerCase();
  const orig = (originalMd ?? "").toLowerCase();
  const matched: string[] = [];
  const missing: string[] = [];
  const added: string[] = [];
  for (const raw of jobKeywords) {
    const k = raw.toLowerCase().trim();
    if (!k) continue;
    if (text.includes(k)) {
      matched.push(raw);
      if (orig && !orig.includes(k)) added.push(raw);
    } else {
      missing.push(raw);
    }
  }
  const word_count = resumeMd.split(/\s+/).filter(Boolean).length;
  const score = jobKeywords.length
    ? Math.round((matched.length / jobKeywords.length) * 100)
    : 70;
  const improvements: string[] = [];
  if (added.length) improvements.push(`Added ${added.length} keyword(s): ${added.slice(0, 6).join(", ")}`);
  if (word_count < 250) improvements.push("Resume is concise — well below ATS truncation limits");
  if (resumeMd.includes("##")) improvements.push("Clear section headers — ATS-friendly");
  if (!/[│┃■◆●▪]/g.test(resumeMd)) improvements.push("No unicode bullets — safe for legacy parsers");
  if (missing.length) improvements.push(`Could still strengthen: ${missing.slice(0, 4).join(", ")}`);
  return { score, matched_keywords: matched, missing_keywords: missing, added_keywords: added, improvements, word_count };
}
