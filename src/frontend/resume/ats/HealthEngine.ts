/**
 * Resume Health Engine — measures intrinsic resume quality, independent of any
 * job description. ATS measures ATS-readability; Health measures content
 * substance.
 */
import type { ResumeJSON } from "@frontend/resume/schema";

export interface HealthReport {
  score: number;
  contentStrength: number;
  projectStrength: number;
  experienceStrength: number;
  achievementStrength: number;
  completeness: number;
  notes: string[];
}

const ACTION_VERBS = /\b(built|designed|developed|implemented|led|launched|optimized|improved|reduced|increased|delivered|shipped|automated|migrated|scaled|architected|integrated|created|deployed|owned|drove|grew|cut|saved|spearheaded|introduced|established|streamlined)\b/i;
const METRIC = /(\d+\s*%|\d+x|\$\d|\b\d{2,}\b)/;

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function contentStrengthOf(r: ResumeJSON): number {
  const summaryLen = r.summary.trim().split(/\s+/).filter(Boolean).length;
  const summaryScore =
    summaryLen === 0 ? 0 : summaryLen < 25 ? 50 : summaryLen <= 90 ? 100 : 70;
  const skillCount = r.skills.reduce((a, g) => a + g.items.length, 0);
  const skillScore = Math.min(100, skillCount * 8);
  return clamp(summaryScore * 0.5 + skillScore * 0.5);
}

function experienceStrengthOf(r: ResumeJSON): number {
  if (!r.experience.length) return 0;
  let bulletScore = 0;
  let totalBullets = 0;
  for (const e of r.experience) {
    for (const b of e.bullets) {
      totalBullets++;
      const words = b.trim().split(/\s+/).length;
      let s = 40;
      if (ACTION_VERBS.test(b)) s += 25;
      if (words >= 8 && words <= 32) s += 15;
      if (METRIC.test(b)) s += 20;
      bulletScore += Math.min(100, s);
    }
  }
  const avgBullet = totalBullets ? bulletScore / totalBullets : 0;
  const volume = Math.min(100, r.experience.length * 25);
  return clamp(avgBullet * 0.75 + volume * 0.25);
}

function projectStrengthOf(r: ResumeJSON): number {
  if (!r.projects.length) return 0;
  let bulletScore = 0;
  let totalBullets = 0;
  for (const p of r.projects) {
    for (const b of p.bullets) {
      totalBullets++;
      const words = b.trim().split(/\s+/).length;
      let s = 40;
      if (ACTION_VERBS.test(b)) s += 25;
      if (words >= 8 && words <= 32) s += 15;
      if (METRIC.test(b)) s += 20;
      bulletScore += Math.min(100, s);
    }
  }
  const stackCount = r.projects.reduce((a, p) => a + p.stack.length, 0);
  const avgBullet = totalBullets ? bulletScore / totalBullets : 0;
  const breadth = Math.min(100, stackCount * 10);
  const volume = Math.min(100, r.projects.length * 30);
  return clamp(avgBullet * 0.5 + breadth * 0.2 + volume * 0.3);
}

function achievementStrengthOf(r: ResumeJSON): number {
  const bullets = [
    ...r.experience.flatMap((e) => e.bullets),
    ...r.projects.flatMap((p) => p.bullets),
  ];
  if (!bullets.length) return 0;
  const withMetric = bullets.filter((b) => METRIC.test(b)).length;
  const withVerb = bullets.filter((b) => ACTION_VERBS.test(b)).length;
  return clamp((withMetric / bullets.length) * 60 + (withVerb / bullets.length) * 40);
}

function completenessOf(r: ResumeJSON): number {
  const checks = [
    !!r.personal.name,
    !!r.personal.email,
    !!r.personal.phone,
    !!r.personal.location,
    r.personal.links.length > 0,
    !!r.summary,
    r.skills.length > 0,
    r.experience.length > 0 || r.projects.length > 0,
    r.education.length > 0,
  ];
  return clamp((checks.filter(Boolean).length / checks.length) * 100);
}

export function analyzeHealth(resume: ResumeJSON): HealthReport {
  const contentStrength = contentStrengthOf(resume);
  const projectStrength = projectStrengthOf(resume);
  const experienceStrength = experienceStrengthOf(resume);
  const achievementStrength = achievementStrengthOf(resume);
  const completeness = completenessOf(resume);

  const score = clamp(
    contentStrength * 0.2 +
    experienceStrength * 0.3 +
    projectStrength * 0.15 +
    achievementStrength * 0.2 +
    completeness * 0.15,
  );

  const notes: string[] = [];
  if (achievementStrength < 60) notes.push("Add measurable outcomes (%, $, scale) to bullets.");
  if (experienceStrength < 60 && resume.experience.length) notes.push("Strengthen experience bullets — start with an action verb.");
  if (projectStrength < 60 && resume.projects.length) notes.push("Expand project bullets with impact and tech stack.");
  if (contentStrength < 60) notes.push("Write a 2–3 sentence professional summary.");
  if (completeness < 100) notes.push("Complete contact details and at least one link.");

  return {
    score,
    contentStrength,
    projectStrength,
    experienceStrength,
    achievementStrength,
    completeness,
    notes,
  };
}
