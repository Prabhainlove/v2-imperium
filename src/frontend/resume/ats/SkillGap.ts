/**
 * Skill Gap analysis — compares resume skills against JD-derived skills.
 * Returns matched, missing, recommended, and coverage %.
 */
import type { ResumeJSON } from "@frontend/resume/schema";
import { analyzeJdMatch } from "./JdMatchEngine";

export interface SkillGapReport {
  matched: string[];
  missing: string[];
  recommended: string[];
  coverage: number; // 0-100
}

const ADJACENT: Record<string, string[]> = {
  react: ["nextjs", "redux", "tailwind", "typescript"],
  nextjs: ["react", "vercel", "typescript"],
  node: ["express", "nestjs", "typescript"],
  nodejs: ["express", "nestjs", "typescript"],
  typescript: ["zod", "react", "node"],
  python: ["fastapi", "django", "pandas", "pytest"],
  aws: ["terraform", "docker", "ci/cd"],
  gcp: ["terraform", "docker"],
  kubernetes: ["docker", "helm", "terraform"],
  docker: ["kubernetes", "ci/cd"],
  postgresql: ["sql", "prisma", "redis"],
  postgres: ["sql", "prisma", "redis"],
  graphql: ["apollo", "typescript"],
  tailwind: ["css", "react"],
};

export function analyzeSkillGap(resume: ResumeJSON, jd: string): SkillGapReport {
  const m = analyzeJdMatch(resume, jd);
  const matched = Array.from(new Set([...m.matchedSkills, ...m.matchedTech]));
  const missing = Array.from(new Set([...m.missingSkills, ...m.missingTech]));
  const coverage = matched.length + missing.length
    ? Math.round((matched.length / (matched.length + missing.length)) * 100)
    : 0;

  // Recommended = adjacent skills to what the user already has that the JD didn't list.
  const have = new Set(matched);
  const rec = new Set<string>();
  for (const s of have) {
    for (const adj of ADJACENT[s] ?? []) {
      if (!have.has(adj) && !missing.includes(adj)) rec.add(adj);
    }
  }
  return {
    matched,
    missing,
    recommended: Array.from(rec).slice(0, 8),
    coverage,
  };
}
