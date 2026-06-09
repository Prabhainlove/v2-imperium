/**
 * Deterministic ATS analysis for Resume Studio. No AI required.
 * Inputs:  ResumeJSON + optional Job Description text.
 * Outputs: AtsReport — scores, matched/missing keywords, section gaps.
 */
import type { ResumeJSON } from "@frontend/resume/schema";

export interface AtsReport {
  atsScore: number;
  keywordMatch: number;       // 0-100
  matchedKeywords: string[];
  missingKeywords: string[];
  sectionCompleteness: number; // 0-100
  formattingSafety: number;    // 0-100
  readability: number;         // 0-100
  experienceQuality: number;   // 0-100
  projectQuality: number;      // 0-100
  contactCompleteness: number; // 0-100
  pageEstimate: number;
  recommendations: string[];
}

const STOP = new Set<string>([
  "a","an","and","or","the","to","of","in","on","for","with","by","at","as",
  "is","are","be","you","we","our","your","this","that","will","plus","etc",
  "from","into","across","using","experience","experienced","work","working",
  "team","teams","role","roles","seeking","familiarity","skills","skill",
  "knowledge","year","years","including","plus","strong","ability","abilities",
  "design","designing","build","building","mentor","mentoring","lead","leading",
]);

const COMMON_TECH = new Set<string>([
  "typescript","javascript","react","nodejs","node","python","java","go","golang",
  "kubernetes","docker","terraform","aws","gcp","azure","postgresql","postgres",
  "mysql","mongodb","redis","graphql","rest","ci/cd","ci","cd","kafka","grpc",
  "html","css","tailwind","nextjs","express","django","fastapi","flask","spring",
  "microservices","distributed","systems","api","apis","sql","nosql","git","github",
  "linux","bash","webpack","vite","jest","cypress","playwright","figma",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#./\- ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function extractKeywords(jd: string): string[] {
  if (!jd) return [];
  const toks = tokenize(jd);
  const freq = new Map<string, number>();
  for (const t of toks) {
    if (STOP.has(t)) continue;
    if (t.length < 2) continue;
    const norm = t.replace(/\.$/, "");
    if (/^\d+$/.test(norm)) continue;
    freq.set(norm, (freq.get(norm) ?? 0) + 1);
  }
  // boost tech terms
  const out = Array.from(freq.entries())
    .map(([k, v]) => [k, v + (COMMON_TECH.has(k) ? 5 : 0)] as const)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([k]) => k);
  return Array.from(new Set(out));
}

function resumeText(r: ResumeJSON): string {
  const parts: string[] = [
    r.personal.name, r.personal.title, r.summary,
    ...r.skills.flatMap((s) => s.items),
    ...r.experience.flatMap((e) => [e.company, e.title, ...e.bullets]),
    ...r.projects.flatMap((p) => [p.name, ...(p.stack ?? []), ...p.bullets]),
    ...r.education.flatMap((e) => [e.school, e.degree, e.field]),
    ...r.certifications.flatMap((c) => [c.name, c.issuer]),
  ];
  return parts.join(" ").toLowerCase();
}

const ACTION_VERBS = /\b(built|designed|developed|implemented|led|launched|optimized|improved|reduced|increased|delivered|shipped|automated|migrated|scaled|architected|integrated|created|deployed|owned)\b/i;
const METRIC = /(\d+\s*%|\d+x|\$\d|\b\d{2,}\b)/;

function bulletQuality(bullets: string[]): number {
  if (!bullets.length) return 0;
  let good = 0;
  for (const b of bullets) {
    const words = b.trim().split(/\s+/).length;
    const v = ACTION_VERBS.test(b);
    const m = METRIC.test(b);
    if (v && words >= 6 && words <= 32 && (m || words >= 10)) good++;
  }
  return Math.round((good / bullets.length) * 100);
}

function fleschReading(text: string): number {
  const sentences = Math.max(1, (text.match(/[.!?]+/g) ?? []).length);
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return 0;
  const syllables = words.reduce((acc, w) => acc + Math.max(1, (w.toLowerCase().match(/[aeiouy]+/g) ?? []).length), 0);
  const score = 206.835 - 1.015 * (words.length / sentences) - 84.6 * (syllables / words.length);
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function analyzeAts(resume: ResumeJSON, jd: string): AtsReport {
  const text = resumeText(resume);
  const keywords = extractKeywords(jd);
  const matched = keywords.filter((k) => text.includes(k));
  const missing = keywords.filter((k) => !text.includes(k));
  const keywordMatch = keywords.length
    ? Math.round((matched.length / keywords.length) * 100)
    : 70;

  const required = [
    !!resume.summary,
    resume.skills.length > 0,
    resume.experience.length > 0 || resume.projects.length > 0,
    resume.education.length > 0,
  ];
  const sectionCompleteness = Math.round((required.filter(Boolean).length / required.length) * 100);

  const contactBits = [
    resume.personal.name, resume.personal.email, resume.personal.phone,
    resume.personal.location, resume.personal.links.length > 0,
  ];
  const contactCompleteness = Math.round((contactBits.filter(Boolean).length / contactBits.length) * 100);

  const expBullets = resume.experience.flatMap((e) => e.bullets);
  const prjBullets = resume.projects.flatMap((p) => p.bullets);
  const experienceQuality = bulletQuality(expBullets);
  const projectQuality = bulletQuality(prjBullets);

  const allBulletText = [...expBullets, ...prjBullets, resume.summary].join(" ");
  const readability = fleschReading(allBulletText || resume.summary || "Resume content.");

  // Formatting safety: classic-ats / professional / minimal templates are safe;
  // sidebar / creative cost some ATS-friendliness.
  const safeTpl = ["classic-ats", "professional", "minimal", "developer"].includes(resume.meta.templateId);
  const formattingSafety = safeTpl ? 95 : 75;

  const charCount = text.length;
  const pageEstimate = Math.max(1, Math.ceil(charCount / 3200));

  const atsScore = Math.round(
    keywordMatch * 0.35 +
    sectionCompleteness * 0.15 +
    Math.max(experienceQuality, projectQuality) * 0.20 +
    contactCompleteness * 0.10 +
    formattingSafety * 0.10 +
    Math.min(100, readability) * 0.10,
  );

  const recommendations: string[] = [];
  if (missing.length) recommendations.push(`Add missing keywords: ${missing.slice(0, 5).join(", ")}.`);
  if (!resume.summary) recommendations.push("Add a professional summary tailored to the role.");
  if (experienceQuality < 60 && expBullets.length) recommendations.push("Tighten experience bullets — start with an action verb and add a metric.");
  if (projectQuality < 60 && prjBullets.length) recommendations.push("Strengthen project bullets with quantifiable outcomes.");
  if (pageEstimate > 2) recommendations.push("Resume runs over 2 pages — trim older or weaker bullets.");
  if (contactCompleteness < 100) recommendations.push("Complete contact info (email, phone, location, links).");

  return {
    atsScore,
    keywordMatch,
    matchedKeywords: matched,
    missingKeywords: missing,
    sectionCompleteness,
    formattingSafety,
    readability,
    experienceQuality,
    projectQuality,
    contactCompleteness,
    pageEstimate,
    recommendations,
  };
}
