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
    const h = line.match(/^##\s+(.*)/);
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
    if (/^###\s+/.test(line)) {
      flush();
      const body = line.replace(/^###\s+/, "");
      const parts = body.split(/\s+\|\s+/);
      const right = parts.length > 1 ? parts[parts.length - 1] : "";
      const left = parts.length > 1 ? parts.slice(0, -1).join(" | ") : body;
      out.push(
        `<div class="role"><span class="role-left"><strong>${esc(left)}</strong></span>${right ? `<span class="role-right">${esc(right)}</span>` : ""}</div>`,
      );
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
      out.push(`<p>${esc(line).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>")}</p>`);
    }
  }
  flush();
  return out.join("");
}

export type ResumeTemplate = "classic" | "modern" | "compact";

const classicCss = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Times New Roman',Times,serif;color:#111;padding:0.6in 0.7in;line-height:1.35;font-size:11pt;background:#fff}
h1{font-size:22pt;font-weight:bold;margin:0 0 4px}
.contact{font-size:10.5pt;color:#222;margin-bottom:14px}
h2{font-size:11pt;font-weight:bold;text-transform:uppercase;letter-spacing:.04em;border-bottom:1.2px solid #111;padding-bottom:2px;margin:14px 0 6px}
.role{display:flex;justify-content:space-between;gap:14px;margin:8px 0 2px}.role-right{white-space:nowrap;font-style:italic;color:#333}
p{margin:3px 0}
ul{margin:4px 0 6px 22px}
li{margin:2px 0;line-height:1.4}
`;
const modernCss = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Calibri','Helvetica Neue',Arial,sans-serif;color:#222;padding:0.55in 0.65in;line-height:1.4;font-size:11pt;background:#fff}
h1{font-size:24pt;font-weight:600;color:#0b2647;text-align:center;margin:0 0 4px}
.contact{font-size:10.5pt;color:#444;text-align:center;border-bottom:2px solid #1a3a6e;padding-bottom:10px;margin-bottom:14px}
h2{font-size:11.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#0b2647;border-bottom:1px solid #c8d3e5;padding-bottom:3px;margin:14px 0 6px}
.role{display:flex;justify-content:space-between;gap:14px;margin:8px 0 2px}.role-right{white-space:nowrap;font-style:italic;color:#555}
p{margin:3px 0}
ul{margin:4px 0 8px 20px}
li{margin:2px 0;line-height:1.4}
`;
const compactCss = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:0.45in 0.55in;line-height:1.25;font-size:10pt;background:#fff}
h1{font-size:18pt;font-weight:bold;margin:0 0 2px}
.contact{font-size:9.5pt;color:#333;margin-bottom:10px}
h2{font-size:10pt;font-weight:bold;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #111;padding-bottom:1px;margin:10px 0 4px}
.role{display:flex;justify-content:space-between;gap:10px;margin:5px 0 1px}.role-right{white-space:nowrap;font-style:italic;color:#333}
p{margin:2px 0}
ul{margin:2px 0 4px 18px}
li{margin:1px 0;line-height:1.3}
`;

export function renderResumeHtml(md: string, template: ResumeTemplate = "classic"): string {
  const parsed = parseResumeMarkdown(md);
  const css = template === "modern" ? modernCss : template === "compact" ? compactCss : classicCss;
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
