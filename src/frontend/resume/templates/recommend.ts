/**
 * Template Recommendation Engine — deterministic, no AI.
 * Suggests the best-fit template from ResumeJSON + optional JD context.
 * Recommendations are advisory; never auto-switch templates.
 */
import type { ResumeJSON } from "@frontend/resume/schema";
import { TEMPLATES, type TemplateMeta } from "./registry";

export interface TemplateRecommendation {
  template: TemplateMeta;
  reason: string;
  confidence: number; // 0-100
}

function totalYears(r: ResumeJSON): number {
  // Rough: count distinct experience entries; each ~1.5 yr if dates missing.
  let years = 0;
  for (const e of r.experience) {
    const s = parseInt(e.start.match(/\d{4}/)?.[0] ?? "");
    const en = e.end ? parseInt(e.end.match(/\d{4}/)?.[0] ?? "") : new Date().getFullYear();
    if (!Number.isNaN(s) && !Number.isNaN(en)) years += Math.max(0, en - s);
    else years += 1.5;
  }
  return Math.round(years);
}

function pickById(id: string): TemplateMeta {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

export function recommendTemplate(resume: ResumeJSON, jd?: string): TemplateRecommendation {
  const years = totalYears(resume);
  const title = (resume.personal.title || "").toLowerCase();
  const jdLower = (jd || "").toLowerCase();
  const hay = `${title} ${jdLower}`;

  // Student / fresher
  if (years < 2 && resume.experience.length <= 1) {
    return {
      template: pickById("minimal"),
      reason: "Early-career profile — Minimal keeps focus on education, projects, and potential.",
      confidence: 78,
    };
  }

  // Developer / engineering
  if (/\b(engineer|developer|sde|swe|backend|frontend|full[- ]?stack|devops|sre|platform)\b/.test(hay)) {
    return {
      template: pickById("developer"),
      reason: "Engineering role — Developer template highlights projects and stack.",
      confidence: 88,
    };
  }

  // Product / Design — Modern
  if (/\b(product|design|ux|ui|brand|creative)\b/.test(hay)) {
    return {
      template: pickById("modern"),
      reason: "Product/design role — Modern's sidebar layout showcases skills visually.",
      confidence: 85,
    };
  }

  // Senior / Executive — Minimal (we'll add Executive in Batch B)
  if (years >= 10 || /\b(senior|principal|staff|lead|director|head|vp|chief)\b/.test(hay)) {
    return {
      template: pickById("minimal"),
      reason: "Senior profile — Minimal projects gravitas and lets accomplishments speak.",
      confidence: 80,
    };
  }

  // Mass applications fallback
  if (resume.experience.length >= 3) {
    return {
      template: pickById("professional"),
      reason: "Mid-career professional — balanced, ATS-friendly, broadly recognized.",
      confidence: 82,
    };
  }

  return {
    template: pickById("classic-ats"),
    reason: "When in doubt, Classic ATS guarantees parsing across every applicant tracking system.",
    confidence: 70,
  };
}
