/**
 * Client-safe ATS-grade resume renderer.
 * - 3 strict single-column, ATS-safe templates (Classic / Modern / Compact)
 * - Markdown → semantic HTML → real-PDF export via jsPDF + html2canvas
 * - All templates use OS-default safe fonts (Times, Calibri, Arial) — no icons,
 *   no tables, no multi-column layouts that confuse ATS parsers.
 */
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { buildAgentContext } from "@backend/profile/AgentContextBuilder";
import { buildResumeFromProfile } from "@backend/profile/ProfileTextGenerators";
import { getSeedOrEmpty } from "@backend/profile/InternalSeedProfile";

export type ResumeTemplate = "jake-ats" | "classic" | "modern" | "compact";

export const RESUME_TEMPLATES: { id: ResumeTemplate; label: string; desc: string }[] = [
  { id: "jake-ats", label: "Jake (ATS)", desc: "FAANG-intern reference. Latin Modern serif, single column, ALL-CAPS section bars. Default." },
  { id: "classic", label: "Classic", desc: "Resume-Worded style. Serif, single column, ALL-CAPS section bars." },
  { id: "modern", label: "Modern", desc: "Sans-serif with role title under name. Still 100% ATS-safe." },
  { id: "compact", label: "Compact", desc: "Dense one-page layout for senior CVs." },
];

interface ParsedResume {
  name: string;
  contact: string;
  sections: { heading: string; lines: string[] }[];
}

function parseResume(md: string): ParsedResume {
  const lines = md.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  const name = (lines[i] ?? "").replace(/^#+\s*/, "").trim() || "Your Name";
  i++;
  let contact = "";
  while (i < lines.length && !lines[i].startsWith("#")) {
    const t = lines[i].trim();
    if (t) contact = contact ? `${contact} | ${t}` : t;
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

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function inline(s: string) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
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
    // ### sub-heading (e.g. Company — Role · dates) — render as bold row
    if (/^###\s+/.test(line)) {
      flush();
      const body = line.replace(/^###\s+/, "");
      // Split on " · " or " — " for date alignment if a tab/right segment exists
      const parts = body.split(/\s+\|\s+|\s+·\s+|\s+—\s+/);
      if (parts.length >= 2) {
        const left = parts.slice(0, -1).join(" — ");
        const right = parts[parts.length - 1];
        out.push(
          `<div class="role"><span class="role-left"><strong>${inline(left)}</strong></span><span class="role-right">${inline(right)}</span></div>`,
        );
      } else {
        out.push(`<div class="role"><strong>${inline(body)}</strong></div>`);
      }
      continue;
    }
    if (/^[-*•]\s+/.test(line)) {
      if (!inUl) {
        out.push("<ul>");
        inUl = true;
      }
      out.push(`<li>${inline(line.replace(/^[-*•]\s+/, ""))}</li>`);
    } else {
      flush();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  flush();
  return out.join("");
}

/* ───────── ATS-grade templates ───────── */

const classicCss = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Times New Roman','Liberation Serif',Times,serif;color:#111;padding:0.6in 0.7in;line-height:1.35;font-size:11pt;background:#fff;width:8.5in}
header{margin-bottom:14px}
h1{font-size:22pt;font-weight:bold;margin:0 0 4px 0;letter-spacing:0}
.contact{font-size:10.5pt;color:#222}
section{margin-top:14px}
h2{font-size:11pt;font-weight:bold;text-transform:uppercase;letter-spacing:.04em;border-bottom:1.2px solid #111;padding-bottom:2px;margin:14px 0 6px 0}
.role{display:flex;justify-content:space-between;align-items:baseline;margin:8px 0 2px 0;font-size:11pt}
.role-right{font-style:italic;font-size:10.5pt;color:#333;white-space:nowrap;padding-left:12px}
p{margin:3px 0;font-size:11pt}
ul{margin:4px 0 6px 22px}
li{margin:2px 0;font-size:11pt;line-height:1.4}
strong{font-weight:bold}
em{font-style:italic}
`;

const modernCss = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Calibri','Helvetica Neue',Arial,sans-serif;color:#222;padding:0.55in 0.65in;line-height:1.4;font-size:11pt;background:#fff;width:8.5in}
header{text-align:center;margin-bottom:16px;padding-bottom:10px;border-bottom:2px solid #1a3a6e}
h1{font-size:24pt;font-weight:600;letter-spacing:.02em;margin:0 0 4px 0;color:#0b2647}
.contact{font-size:10.5pt;color:#444}
section{margin-top:12px}
h2{font-size:11.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#0b2647;margin:14px 0 6px 0;padding-bottom:3px;border-bottom:1px solid #c8d3e5}
.role{display:flex;justify-content:space-between;align-items:baseline;margin:8px 0 2px 0}
.role-right{font-style:italic;font-size:10.5pt;color:#555;white-space:nowrap;padding-left:12px}
p{margin:3px 0}
ul{margin:4px 0 8px 20px}
li{margin:2px 0;line-height:1.4}
strong{font-weight:600;color:#0b2647}
em{font-style:italic;color:#555}
`;

const compactCss = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Arial','Helvetica',sans-serif;color:#111;padding:0.45in 0.55in;line-height:1.25;font-size:10pt;background:#fff;width:8.5in}
header{margin-bottom:10px}
h1{font-size:18pt;font-weight:bold;margin:0 0 2px 0}
.contact{font-size:9.5pt;color:#333}
section{margin-top:10px}
h2{font-size:10pt;font-weight:bold;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #111;padding-bottom:1px;margin:10px 0 4px 0}
.role{display:flex;justify-content:space-between;align-items:baseline;margin:5px 0 1px 0;font-size:10pt}
.role-right{font-style:italic;font-size:9.5pt;color:#333;white-space:nowrap;padding-left:8px}
p{margin:2px 0;font-size:10pt}
ul{margin:2px 0 4px 18px}
li{margin:1px 0;font-size:10pt;line-height:1.3}
strong{font-weight:bold}
`;

const jakeAtsCss = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Latin Modern Roman','Computer Modern','Times New Roman',Times,serif;color:#111;padding:0.5in 0.55in;line-height:1.3;font-size:10.5pt;background:#fff;width:8.5in}
header{margin-bottom:8px;text-align:center}
h1{font-size:20pt;font-weight:bold;letter-spacing:0.02em;margin:0 0 2px 0}
.contact{font-size:10pt;color:#111}
section{margin-top:8px}
h2{font-size:11pt;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1.2px solid #111;padding-bottom:1px;margin:10px 0 3px 0}
.role{display:flex;justify-content:space-between;align-items:baseline;margin:5px 0 1px 0;font-size:10.5pt}
.role-right{font-style:italic;font-size:10pt;color:#222;white-space:nowrap;padding-left:10px}
p{margin:2px 0;font-size:10.5pt}
ul{margin:2px 0 4px 18px}
li{margin:1px 0;font-size:10.5pt;line-height:1.35}
strong{font-weight:bold}
em{font-style:italic}
`;

const templateCss: Record<ResumeTemplate, string> = {
  "jake-ats": jakeAtsCss,
  classic: classicCss,
  modern: modernCss,
  compact: compactCss,
};

export function renderResumeHtml(md: string, template: ResumeTemplate = "jake-ats"): string {
  const parsed = parseResume(md);
  const css = templateCss[template] ?? jakeAtsCss;
  const body = parsed.sections
    .map((s) => `<section><h2>${esc(s.heading)}</h2>${renderLines(s.lines)}</section>`)
    .join("");
  const headerName = template === "modern" ? `<h1>${esc(parsed.name.toUpperCase())}</h1>` : `<h1>${esc(parsed.name)}</h1>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(parsed.name)} — Resume</title><style>${css}</style></head><body><header>${headerName}${parsed.contact ? `<div class="contact">${esc(parsed.contact)}</div>` : ""}</header>${body}</body></html>`;
}

/* ───────── PDF export (real PDF, multi-page A4) ───────── */

export async function downloadResumePdf(
  md: string,
  template: ResumeTemplate,
  filename = "resume.pdf",
): Promise<void> {
  const html = renderResumeHtml(md, template);
  // Off-screen iframe → render → capture → multi-page A4 PDF
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.left = "-99999px";
  frame.style.top = "0";
  frame.style.width = "816px"; // 8.5in @ 96dpi
  frame.style.height = "1056px"; // 11in
  frame.style.border = "0";
  document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument!;
    doc.open();
    doc.write(html);
    doc.close();
    await new Promise((r) => setTimeout(r, 100));
    const target = doc.body;
    const canvas = await html2canvas(target, {
      scale: 2,
      backgroundColor: "#ffffff",
      windowWidth: 816,
      useCORS: true,
      logging: false,
    });
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    let remaining = imgH;
    let position = 0;
    const img = canvas.toDataURL("image/jpeg", 0.95);
    pdf.addImage(img, "JPEG", 0, position, imgW, imgH);
    remaining -= pageH;
    while (remaining > 0) {
      position -= pageH;
      pdf.addPage();
      pdf.addImage(img, "JPEG", 0, position, imgW, imgH);
      remaining -= pageH;
    }
    pdf.save(filename);
  } finally {
    document.body.removeChild(frame);
  }
}

/* ───────── Profile → ATS Markdown (used by live editor + demo profile) ───────── */

export interface ProfileLike {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  headline?: string;
  summary?: string;
  linkedin_url?: string;
  github_url?: string;
  portfolio_url?: string;
  skills?: string[];
  experience?: Array<{
    title?: string;
    company?: string;
    location?: string;
    start?: string;
    end?: string;
    current?: boolean;
    description?: string;
    highlights?: string[];
  }>;
  education?: Array<{
    school?: string;
    degree?: string;
    field?: string;
    start?: string;
    end?: string;
    gpa?: string;
    description?: string;
  }>;
  certifications?: Array<{ name?: string; issuer?: string; year?: string }>;
  languages?: Array<{ name?: string; proficiency?: string }>;
}

export function profileToResumeMarkdown(p: ProfileLike): string {
  return buildResumeFromProfile(buildAgentContext(p as never));
}

/* ───────── Readability + ATS heuristics (kept for studio) ───────── */

export interface ReadabilityReport {
  word_count: number;
  bullet_count: number;
  avg_bullet_words: number;
  section_count: number;
  sentence_count: number;
  long_bullets: number;
  has_contact: boolean;
  has_sections: boolean;
  flesch_reading_ease: number;
  recruiter_grade: "A" | "B" | "C" | "D";
  notes: string[];
}

function syllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!word) return 0;
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  word = word.replace(/^y/, "");
  const m = word.match(/[aeiouy]{1,2}/g);
  return m ? m.length : 1;
}

export function analyzeReadability(md: string): ReadabilityReport {
  const parsed = parseResume(md);
  const words = md.split(/\s+/).filter(Boolean);
  const bullets = (md.match(/^\s*[-*•]\s+/gm) ?? []).length;
  const bulletLines = md
    .split(/\r?\n/)
    .filter((l) => /^\s*[-*•]\s+/.test(l))
    .map((l) => l.replace(/^\s*[-*•]\s+/, ""));
  const bulletWords = bulletLines.reduce((a, l) => a + l.split(/\s+/).filter(Boolean).length, 0);
  const avgBullet = bullets ? Math.round(bulletWords / bullets) : 0;
  const longBullets = bulletLines.filter((l) => l.split(/\s+/).length > 28).length;
  const sentences = (md.match(/[.!?](?:\s|$)/g) ?? []).length || 1;
  const syll = words.reduce((a, w) => a + syllables(w), 0);
  const fres = Math.max(
    0,
    Math.min(100, Math.round(206.835 - 1.015 * (words.length / sentences) - 84.6 * (syll / Math.max(1, words.length)))),
  );
  const notes: string[] = [];
  if (!parsed.contact) notes.push("Add a contact line (email · phone · location) under your name.");
  if (parsed.sections.length < 3) notes.push("Add more sections — recruiters scan for Experience, Skills, Education.");
  if (longBullets) notes.push(`${longBullets} bullet(s) are >28 words — tighten for skim-reading.`);
  if (bullets < 6) notes.push("Add more concise bullets — recruiters skim before they read.");
  if (avgBullet > 0 && avgBullet < 6) notes.push("Some bullets are very short — strengthen with an outcome / metric.");
  if (words.length > 700) notes.push("Resume is long — aim for ≤1 page (≈450–650 words).");
  if (/[│┃■◆●▪]/.test(md)) notes.push("Unicode bullets detected — switch to '-' for ATS safety.");

  let grade: ReadabilityReport["recruiter_grade"] = "A";
  const penalties =
    (parsed.contact ? 0 : 1) +
    (parsed.sections.length >= 3 ? 0 : 1) +
    (longBullets > 0 ? 1 : 0) +
    (words.length > 800 ? 1 : 0) +
    (fres < 35 ? 1 : 0);
  if (penalties >= 3) grade = "D";
  else if (penalties === 2) grade = "C";
  else if (penalties === 1) grade = "B";

  return {
    word_count: words.length,
    bullet_count: bullets,
    avg_bullet_words: avgBullet,
    section_count: parsed.sections.length,
    sentence_count: sentences,
    long_bullets: longBullets,
    has_contact: !!parsed.contact,
    has_sections: parsed.sections.length > 0,
    flesch_reading_ease: fres,
    recruiter_grade: grade,
    notes,
  };
}

const STOP = new Set("a,an,the,and,or,for,of,in,on,to,with,by,at,as,is,are,was,were,be,been,being,from,that,this,it,its,into,you,your,we,our,i,me,my,but,not,if,so,do,did,done,have,has,had,will,can,more,less,than,then".split(","));

export function extractKeywords(text: string, max = 25): string[] {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\-/ ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([k]) => k);
}

export interface QuickAts {
  score: number;
  matched: string[];
  missing: string[];
}

export function quickAts(resumeMd: string, jobDescription: string): QuickAts {
  const keywords = extractKeywords(jobDescription, 20);
  const text = resumeMd.toLowerCase();
  const matched: string[] = [];
  const missing: string[] = [];
  for (const k of keywords) (text.includes(k) ? matched : missing).push(k);
  const score = keywords.length ? Math.round((matched.length / keywords.length) * 100) : 0;
  return { score, matched, missing };
}

/* ───────── Demo profile: dev-only seed; empty stub in production ───────── */

export const DEMO_PROFILE: ProfileLike = getSeedOrEmpty();

/* ───────── Cover letter rendering ───────── */

export interface CoverLetterFields {
  candidate_name: string;
  candidate_title?: string;
  candidate_email?: string;
  candidate_phone?: string;
  candidate_location?: string;
  company: string;
  hiring_manager?: string;
  body: string; // markdown / plain text paragraphs separated by blank lines
}

export function renderCoverLetterHtml(f: CoverLetterFields): string {
  const paragraphs = f.body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${inline(p)}</p>`)
    .join("");
  const contact = [f.candidate_location, f.candidate_email, f.candidate_phone].filter(Boolean);
  const css = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Calibri','Arial',sans-serif;color:#111;padding:0.75in 0.85in;line-height:1.5;font-size:11.5pt;background:#fff;width:8.5in}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px}
.name{font-size:18pt;font-weight:600;color:#0b2647}
.title{font-size:11pt;color:#555;margin-top:2px}
.contact{font-size:10.5pt;color:#444;text-align:right;line-height:1.45}
.greeting{margin-bottom:14px}
p{margin:0 0 12px 0}
.sign{margin-top:24px}
`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(f.candidate_name)} — Cover Letter</title><style>${css}</style></head><body>
<div class="header">
  <div>
    <div class="name">${esc(f.candidate_name)}</div>
    ${f.candidate_title ? `<div class="title">${esc(f.candidate_title)}</div>` : ""}
  </div>
  ${contact.length ? `<div class="contact">${contact.map((s) => esc(String(s))).join("<br/>")}</div>` : ""}
</div>
<div class="greeting"><p>Dear ${esc(f.hiring_manager || "Hiring Manager")},</p></div>
${paragraphs}
<div class="sign"><p>Sincerely,<br/>${esc(f.candidate_name)}</p></div>
</body></html>`;
}

export async function downloadCoverLetterPdf(
  f: CoverLetterFields,
  filename = "cover-letter.pdf",
): Promise<void> {
  const html = renderCoverLetterHtml(f);
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.left = "-99999px";
  frame.style.top = "0";
  frame.style.width = "816px";
  frame.style.height = "1056px";
  frame.style.border = "0";
  document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument!;
    doc.open();
    doc.write(html);
    doc.close();
    await new Promise((r) => setTimeout(r, 100));
    const canvas = await html2canvas(doc.body, {
      scale: 2,
      backgroundColor: "#ffffff",
      windowWidth: 816,
      useCORS: true,
      logging: false,
    });
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    let remaining = imgH;
    let position = 0;
    const img = canvas.toDataURL("image/jpeg", 0.95);
    pdf.addImage(img, "JPEG", 0, position, imgW, imgH);
    remaining -= pageH;
    while (remaining > 0) {
      position -= pageH;
      pdf.addPage();
      pdf.addImage(img, "JPEG", 0, position, imgW, imgH);
      remaining -= pageH;
    }
    pdf.save(filename);
  } finally {
    document.body.removeChild(frame);
  }
}
