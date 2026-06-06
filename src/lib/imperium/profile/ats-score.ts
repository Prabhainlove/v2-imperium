/**
 * ATS Scoring + Gap Analysis.
 * Profile-aware: separates "missing from resume" from "missing from profile".
 */
import type { JDAnalysis } from "./jd-analysis";
import { skillMatches } from "./jd-analysis";
import type { AgentContext } from "./agent-context";

export interface AtsReport {
  atsScore: number;
  keywordCoverage: number;
  matchedSkills: string[];
  /** Skills required by JD that are absent from the candidate's profile. */
  missingSkills: string[];
  /** Skills in profile but not surfaced on resume — easy wins. */
  underutilizedSkills: string[];
  /** Profile-safe recommendations (never fabricate). */
  recommendations: string[];
  resumeGaps: string[];
}

const GENERIC_OPENERS = /^\s*[-*•]?\s*(developed a|built a|created a|worked on|helped|responsible for|tasked with)/i;

function bulletQualityScore(resumeMd: string): number {
  const bullets = resumeMd.split(/\r?\n/).filter((l) => /^\s*[-*•]\s+/.test(l));
  if (!bullets.length) return 0;
  let good = 0;
  for (const b of bullets) {
    const words = b.split(/\s+/).filter(Boolean);
    const hasOutcome = /\b(improving|reducing|increasing|supporting|enabling|delivering|achieving|powering|scaling|automating|optimizing)\b/i.test(b);
    const notGeneric = !GENERIC_OPENERS.test(b);
    const lenOk = words.length >= 6 && words.length <= 32;
    if (notGeneric && lenOk && (hasOutcome || words.length >= 10)) good++;
  }
  return good / bullets.length;
}

function sectionCompleteness(resumeMd: string): number {
  const required = ["summary", "skill", "project", "education"];
  const lower = resumeMd.toLowerCase();
  const hits = required.filter((r) => new RegExp(`^##\\s*[^\\n]*${r}`, "im").test(lower)).length;
  return hits / required.length;
}

export function calculateATSMatch(
  resumeMd: string,
  jd: JDAnalysis,
  ctx: AgentContext,
): AtsReport {
  const profileSkillsLower = new Set(ctx.skills.map((s) => s.toLowerCase()));
  const profileText = [
    ctx.skills.join(" "),
    ctx.projects.map((p) => [p.name, p.description, (p.stack ?? []).join(" "), (p.highlights ?? []).join(" ")].join(" ")).join(" "),
    ctx.experience.map((e) => [e.title, e.company, e.description, (e.highlights ?? []).join(" ")].join(" ")).join(" "),
  ].join(" ").toLowerCase();

  const matchedSkills: string[] = [];
  const missingSkills: string[] = []; // missing from profile entirely
  const underutilizedSkills: string[] = []; // in profile but not on resume

  const resumeLower = resumeMd.toLowerCase();
  const allJdSkills = Array.from(new Set([...jd.requiredSkills, ...jd.preferredSkills]));

  for (const skill of allJdSkills) {
    const onResume = skillMatches(skill, resumeLower);
    const inProfile = profileSkillsLower.has(skill.toLowerCase()) || skillMatches(skill, profileText);
    if (onResume) matchedSkills.push(skill);
    else if (inProfile) underutilizedSkills.push(skill);
    else missingSkills.push(skill);
  }

  const requiredHits = jd.requiredSkills.filter((s) => skillMatches(s, resumeLower)).length;
  const preferredHits = jd.preferredSkills.filter((s) => skillMatches(s, resumeLower)).length;

  const reqCoverage = jd.requiredSkills.length ? requiredHits / jd.requiredSkills.length : 0.8;
  const prefCoverage = jd.preferredSkills.length ? preferredHits / jd.preferredSkills.length : 0.6;
  const sectionScore = sectionCompleteness(resumeMd);
  const bulletScore = bulletQualityScore(resumeMd);

  const atsScore = Math.round(
    (reqCoverage * 0.55 + prefCoverage * 0.2 + sectionScore * 0.15 + bulletScore * 0.1) * 100,
  );
  const keywordCoverage = Math.round(
    (allJdSkills.length ? matchedSkills.length / allJdSkills.length : 0.8) * 100,
  );

  const recommendations: string[] = [];
  if (underutilizedSkills.length) {
    recommendations.push(
      `Surface ${underutilizedSkills.slice(0, 4).join(", ")} from your profile in a project bullet or skill row.`,
    );
  }
  if (missingSkills.length) {
    const top = missingSkills.slice(0, 3).join(", ");
    recommendations.push(`Consider adding ${top} to your profile only after you have real project evidence — never fabricate.`);
  }
  if (bulletScore < 0.5) {
    recommendations.push("Tighten project bullets: lead with a strong action verb, include the technology, end with a measurable or qualitative outcome.");
  }
  if (sectionScore < 1) {
    recommendations.push("Ensure your resume has all four core sections: Summary, Skills, Projects (or Experience), and Education.");
  }

  const resumeGaps: string[] = [];
  for (const s of missingSkills.slice(0, 6)) resumeGaps.push(`Missing ${s} experience`);

  return {
    atsScore: Math.max(0, Math.min(100, atsScore)),
    keywordCoverage: Math.max(0, Math.min(100, keywordCoverage)),
    matchedSkills: Array.from(new Set(matchedSkills)),
    missingSkills: Array.from(new Set(missingSkills)),
    underutilizedSkills: Array.from(new Set(underutilizedSkills)),
    recommendations,
    resumeGaps,
  };
}
