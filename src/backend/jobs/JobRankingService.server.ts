/**
 * JobRankingService — computes the per-job match score, axis breakdown, and
 * the human-readable Job Intelligence label. Pure function — no I/O.
 *
 * Resume readiness is intentionally NOT computed here (resume scoring lives
 * in Resume Studio, after the user picks a job).
 */
import type { RawJob } from "@backend/jobs/JobSources.server";

export type IntelligenceLabel = "high_opportunity" | "strong_match" | "competitive" | "long_shot";

export interface MatchBreakdown {
  skills: number;
  experience: number;
  role: number;
  salary: number;
  location: number;
}

export interface RankingResult {
  matchScore: number;
  intelligence: IntelligenceLabel;
  breakdown: MatchBreakdown;
  matchedSkills: string[];
  missingSkills: string[];
}

export interface CandidateContext {
  role: string;
  skills: string[];
  experience: string;
  location: string;
  desiredSalaryMin?: number | null;
}

function norm(v: string): string {
  return v.toLowerCase().replace(/\.js\b/g, "").replace(/[^a-z0-9+#]+/g, " ").trim();
}

const ALIASES: Record<string, string[]> = {
  react: ["reactjs", "react.js"],
  node: ["nodejs", "node.js"],
  postgres: ["postgresql"],
  postgresql: ["postgres"],
  javascript: ["js"],
  typescript: ["ts"],
  kubernetes: ["k8s"],
};

function skillHits(skill: string, hay: string): boolean {
  const n = norm(skill);
  if (!n) return false;
  if (hay.includes(n)) return true;
  return (ALIASES[n] ?? []).some((a) => hay.includes(a));
}

function labelFor(score: number): IntelligenceLabel {
  if (score >= 0.8) return "high_opportunity";
  if (score >= 0.6) return "strong_match";
  if (score >= 0.4) return "competitive";
  return "long_shot";
}

export function rankJob(job: RawJob, ctx: CandidateContext): RankingResult {
  const hay = norm(`${job.title} ${job.description} ${job.tech_stack.join(" ")}`);

  const roleTerms = ctx.role.toLowerCase().split(/\s+/).filter((s) => s.length > 2);
  const roleHits = roleTerms.filter((r) => job.title.toLowerCase().includes(r)).length;
  const role = roleTerms.length ? roleHits / roleTerms.length : 0.5;

  const wanted = ctx.skills.map((s) => s.trim()).filter(Boolean);
  const matched: string[] = [];
  const missing: string[] = [];
  for (const s of wanted) {
    if (skillHits(s, hay)) matched.push(s);
    else missing.push(s);
  }
  const skills = wanted.length ? matched.length / wanted.length : 0.5;

  const loc = ctx.location.toLowerCase().trim();
  const jobLoc = (job.location || "").toLowerCase();
  let location: number;
  if (!loc || loc === "remote" || loc === "anywhere") location = job.remote ? 1 : 0.6;
  else if (jobLoc.includes(loc)) location = 1;
  else location = job.remote ? 0.8 : 0.3;

  const wantYrs = Number(ctx.experience.match(/\d+/)?.[0] ?? 0);
  const jobYrs = Number((job.description.match(/(\d+)\+?\s*(?:years|yrs)/i) ?? [])[1] ?? 0);
  let experience = 0.7;
  if (wantYrs > 0 && jobYrs > 0) {
    const diff = Math.abs(wantYrs - jobYrs);
    experience = diff <= 1 ? 1 : diff <= 3 ? 0.7 : 0.4;
  }

  let salary = 0.7;
  if (ctx.desiredSalaryMin && job.salary_min) {
    salary = job.salary_min >= ctx.desiredSalaryMin ? 1 : Math.max(0.2, job.salary_min / ctx.desiredSalaryMin);
  }

  const matchScore = Math.min(
    1,
    skills * 0.4 + role * 0.3 + location * 0.12 + experience * 0.12 + salary * 0.06 + (job.remote ? 0.02 : 0),
  );

  return {
    matchScore,
    intelligence: labelFor(matchScore),
    breakdown: {
      skills: Number(skills.toFixed(2)),
      experience: Number(experience.toFixed(2)),
      role: Number(role.toFixed(2)),
      salary: Number(salary.toFixed(2)),
      location: Number(location.toFixed(2)),
    },
    matchedSkills: matched,
    missingSkills: missing,
  };
}
