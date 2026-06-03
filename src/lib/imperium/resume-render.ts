/**
 * Client-safe resume markdown → HTML renderer.
 * Zero dependencies. Mirrors the server renderer but adds 2 extra templates
 * (elegant, minimal) and exposes readability heuristics for the Studio UI.
 */

export type ResumeTemplate = "classic" | "modern" | "compact" | "elegant" | "minimal";

export const RESUME_TEMPLATES: { id: ResumeTemplate; label: string; desc: string }[] = [
  { id: "classic", label: "Classic", desc: "ATS-safe, serifless, single column" },
  { id: "modern", label: "Modern", desc: "Accent color headings, clean grid" },
  { id: "compact", label: "Compact", desc: "Dense layout for senior CVs" },
  { id: "elegant", label: "Elegant", desc: "Subtle serif, generous spacing" },
  { id: "minimal", label: "Minimal", desc: "Pure typography, no rules" },
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

const baseCss = `
*{box-sizing:border-box}
body{font-family:'Inter','Helvetica Neue',Arial,sans-serif;color:#111;margin:0;padding:32px 40px;line-height:1.45;font-size:11pt;background:#fff}
h1{font-size:22pt;margin:0 0 4px;letter-spacing:-.01em}
.contact{color:#444;font-size:10pt;margin-bottom:14px}
h2{font-size:11pt;text-transform:uppercase;letter-spacing:.08em;border-bottom:1.5px solid #111;padding-bottom:3px;margin:18px 0 8px;color:#111}
p{margin:4px 0}
ul{margin:4px 0 8px 18px;padding:0}
li{margin:2px 0}
strong{font-weight:600}
@media print{body{padding:18mm 18mm}}`;

const templateCss: Record<ResumeTemplate, string> = {
  classic: "",
  modern: `body{font-family:'Inter',system-ui,sans-serif}h1{color:#0b3b8c}h2{color:#0b3b8c;border-bottom-color:#0b3b8c}`,
  compact: `body{font-size:10pt;padding:24px 32px;line-height:1.35}h1{font-size:18pt}h2{font-size:10pt;margin:12px 0 4px}`,
  elegant: `body{font-family:'Georgia','Times New Roman',serif;color:#1a1a1a;padding:40px 48px;line-height:1.55}h1{font-weight:500;letter-spacing:0}h2{font-family:'Inter',sans-serif;border-bottom:none;color:#555;font-size:10pt;letter-spacing:.14em;margin-top:22px}`,
  minimal: `body{padding:36px 44px}h1{font-weight:500}h2{border-bottom:none;color:#888;padding:0;margin:20px 0 6px;font-size:10pt}ul{list-style:none;margin-left:0}li::before{content:"— ";color:#aaa}`,
};

export function renderResumeHtml(md: string, template: ResumeTemplate = "classic"): string {
  const parsed = parseResume(md);
  const css = baseCss + (templateCss[template] ?? "");
  const body = parsed.sections
    .map((s) => `<section><h2>${esc(s.heading)}</h2>${renderLines(s.lines)}</section>`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(parsed.name)} — Resume</title><style>${css}</style></head><body><header><h1>${esc(parsed.name)}</h1>${parsed.contact ? `<div class="contact">${esc(parsed.contact)}</div>` : ""}</header>${body}</body></html>`;
}

/* ───────── Readability + ATS heuristics ───────── */

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
  // Flesch reading ease
  const fres = Math.max(
    0,
    Math.min(
      100,
      Math.round(206.835 - 1.015 * (words.length / sentences) - 84.6 * (syll / Math.max(1, words.length))),
    ),
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
