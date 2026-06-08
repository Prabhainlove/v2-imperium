/**
 * Imperium Profile — Completeness Engine.
 * Deterministic scoring across 10 weighted categories. Client-safe (no IO).
 */
import type { ImperiumProfile } from "@backend/ai/AiTypes";

export interface CategoryScore {
  key: string;
  label: string;
  weight: number;
  score: number; // 0..1
  passed: boolean;
  reason: string;
}

export interface ProfileCompleteness {
  completion: number;        // 0..1
  strength: number;          // 0..100 — quality-weighted
  readiness: number;         // 0..100 — apply-ready
  categories: CategoryScore[];
  missing_sections: string[];
  recommendations: string[];
}

const CATS: Array<{
  key: string;
  label: string;
  weight: number;
  score: (p: Partial<ImperiumProfile>) => number;
  reason: (s: number) => string;
}> = [
  {
    key: "personal",
    label: "Personal Information",
    weight: 8,
    score: (p) => avg([
      bool(p.name), bool(p.email), bool(p.location), bool(p.phone), bool(p.headline),
    ]),
    reason: (s) => s >= 1 ? "Complete" : "Add name, contact and headline",
  },
  {
    key: "career",
    label: "Career Information",
    weight: 12,
    score: (p) => avg([
      bool(p.target_role), bool(p.seniority), bool(p.work_mode),
      (p.target_locations?.length ?? 0) > 0 ? 1 : 0,
    ]),
    reason: (s) => s >= 1 ? "Complete" : "Set target role, seniority, work mode and locations",
  },
  {
    key: "summary",
    label: "Professional Summary",
    weight: 8,
    score: (p) => clamp((p.summary?.trim().length ?? 0) / 240),
    reason: (s) => s >= 1 ? "Strong summary" : "Write a 2–4 sentence professional summary",
  },
  {
    key: "skills",
    label: "Skills",
    weight: 12,
    score: (p) => clamp((p.skills?.length ?? 0) / 8),
    reason: (s) => s >= 1 ? "Strong skill coverage" : "Add at least 8 core skills",
  },
  {
    key: "experience",
    label: "Experience",
    weight: 14,
    score: (p) => clamp((p.experience?.length ?? 0) / 2),
    reason: (s) => s >= 1 ? "Solid work history" : "Add at least 2 roles with highlights",
  },
  {
    key: "projects",
    label: "Projects",
    weight: 10,
    score: (p) => clamp((p.projects?.length ?? 0) / 3),
    reason: (s) => s >= 1 ? "Strong project portfolio" : "Add 3+ projects with stack & links",
  },
  {
    key: "education",
    label: "Education",
    weight: 8,
    score: (p) => clamp((p.education?.length ?? 0) / 1),
    reason: (s) => s >= 1 ? "Complete" : "Add your most recent education",
  },
  {
    key: "certifications",
    label: "Certifications",
    weight: 5,
    score: (p) => clamp((p.certifications?.length ?? 0) / 1),
    reason: (s) => s >= 1 ? "Complete" : "Add at least one certification",
  },
  {
    key: "github",
    label: "GitHub",
    weight: 10,
    score: (p) => {
      const url = bool(p.github_url);
      const intel = p.github_intel && (p.github_intel as { username?: string }).username ? 1 : 0;
      return avg([url, intel]);
    },
    reason: (s) => s >= 1 ? "GitHub connected & analyzed" : "Connect GitHub and run analysis",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    weight: 8,
    score: (p) => bool(p.linkedin_url),
    reason: (s) => s >= 1 ? "Complete" : "Add LinkedIn URL",
  },
  {
    key: "portfolio",
    label: "Portfolio / Site",
    weight: 5,
    score: (p) => bool(p.portfolio_url),
    reason: (s) => s >= 1 ? "Complete" : "Add a portfolio or personal site",
  },
];

function bool(v: unknown): number {
  if (typeof v === "string") return v.trim().length > 0 ? 1 : 0;
  return v ? 1 : 0;
}
function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}
function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function computeCompleteness(
  profile: Partial<ImperiumProfile> | null | undefined,
): ProfileCompleteness {
  const p = profile ?? {};
  const totalWeight = CATS.reduce((a, c) => a + c.weight, 0);
  const categories: CategoryScore[] = CATS.map((c) => {
    const s = clamp(c.score(p));
    return {
      key: c.key,
      label: c.label,
      weight: c.weight,
      score: s,
      passed: s >= 0.999,
      reason: c.reason(s),
    };
  });
  const weightedSum = categories.reduce((a, c) => a + c.score * c.weight, 0);
  const completion = weightedSum / totalWeight;

  // Strength weights quality signals (summary length, project count, intel).
  const strengthBoost =
    (clamp((p.summary?.length ?? 0) / 500) * 0.15) +
    (clamp((p.projects?.length ?? 0) / 5) * 0.15) +
    ((p.github_intel as { summary?: string })?.summary ? 0.1 : 0);
  const strength = Math.round(Math.min(1, completion * 0.9 + strengthBoost) * 100);

  // Readiness gates on the must-haves for apply.
  const mustHaves = ["personal", "summary", "skills", "experience"];
  const mustHaveScore =
    categories.filter((c) => mustHaves.includes(c.key)).reduce((a, c) => a + c.score, 0) /
    mustHaves.length;
  const readiness = Math.round(Math.min(1, mustHaveScore * 0.7 + completion * 0.3) * 100);

  const missing_sections = categories
    .filter((c) => !c.passed)
    .sort((a, b) => b.weight * (1 - b.score) - a.weight * (1 - a.score))
    .map((c) => c.label);

  const recommendations = categories
    .filter((c) => !c.passed)
    .sort((a, b) => b.weight * (1 - b.score) - a.weight * (1 - a.score))
    .slice(0, 4)
    .map((c) => c.reason);

  return {
    completion,
    strength,
    readiness,
    categories,
    missing_sections,
    recommendations,
  };
}

export const APPLY_READINESS_THRESHOLD = 55;
