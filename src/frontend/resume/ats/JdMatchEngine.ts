/**
 * JD Match Engine — deterministic, weighted resume↔JD overlap.
 *  - Skills        50%
 *  - Technologies  30%
 *  - Responsibilities 20%
 *
 * No AI required. Pure string analysis over ResumeJSON + JD text.
 */
import type { ResumeJSON } from "@frontend/resume/schema";

export interface JdMatchReport {
  score: number;
  skillsMatch: number;
  techMatch: number;
  responsibilitiesMatch: number;
  matchedSkills: string[];
  missingSkills: string[];
  matchedTech: string[];
  missingTech: string[];
}

const TECH = new Set<string>([
  "typescript","javascript","react","node","nodejs","node.js","python","java",
  "go","golang","rust","kotlin","swift","ruby","php","c#","c++","scala",
  "kubernetes","docker","terraform","ansible","jenkins","github actions",
  "aws","gcp","azure","cloudflare",
  "postgresql","postgres","mysql","mongodb","redis","dynamodb","snowflake","bigquery",
  "graphql","rest","grpc","kafka","rabbitmq",
  "html","css","tailwind","sass","nextjs","next.js","nuxt","remix","svelte","vue","angular",
  "express","nestjs","django","fastapi","flask","spring","rails",
  "tensorflow","pytorch","sklearn","scikit-learn","pandas","numpy",
  "vite","webpack","jest","vitest","cypress","playwright","storybook",
  "linux","bash","git","figma","jira","ci/cd",
]);

const RESPONSIBILITY_HINTS = [
  "design", "architect", "build", "develop", "implement", "deliver", "ship",
  "lead", "mentor", "collaborate", "review", "optimize", "scale", "deploy",
  "maintain", "monitor", "test", "document", "own", "drive", "launch",
];

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#./\- ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function uniq<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

function resumeSkillSet(r: ResumeJSON): Set<string> {
  const all = r.skills.flatMap((g) => g.items.map((s) => s.toLowerCase().trim()));
  return new Set(all);
}

function resumeTechSet(r: ResumeJSON): Set<string> {
  const tokens = [
    ...r.skills.flatMap((g) => g.items),
    ...r.experience.flatMap((e) => [e.title, ...e.bullets]),
    ...r.projects.flatMap((p) => [...p.stack, ...p.bullets]),
    r.summary,
  ].join(" ").toLowerCase();
  const set = new Set<string>();
  for (const t of TECH) if (tokens.includes(t)) set.add(t);
  return set;
}

function extractJdSkills(jd: string): string[] {
  // Heuristic: capture phrases following "skills:", "requirements:", etc.
  // plus capitalized noun candidates.
  const skills: string[] = [];
  const cleaned = jd.replace(/\s+/g, " ");
  const sectionRe = /(?:skills|requirements|qualifications|must have|nice to have)[:\-]?\s*([^.]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = sectionRe.exec(cleaned))) {
    skills.push(
      ...m[1].split(/[,;•·\u2022/|]/).map((s) => s.trim().toLowerCase()).filter((s) => s && s.length < 32),
    );
  }
  // Fallback: pick TECH tokens directly mentioned in JD.
  const lowered = jd.toLowerCase();
  for (const t of TECH) if (lowered.includes(t)) skills.push(t);
  return uniq(skills.filter(Boolean)).slice(0, 30);
}

function extractJdTech(jd: string): string[] {
  const lowered = jd.toLowerCase();
  return Array.from(TECH).filter((t) => lowered.includes(t));
}

function extractJdResponsibilities(jd: string): string[] {
  const toks = tokenize(jd);
  const set = new Set<string>();
  for (const t of toks) if (RESPONSIBILITY_HINTS.includes(t)) set.add(t);
  return Array.from(set);
}

function resumeResponsibilities(r: ResumeJSON): Set<string> {
  const toks = tokenize(
    [...r.experience.flatMap((e) => e.bullets), ...r.projects.flatMap((p) => p.bullets), r.summary].join(" "),
  );
  const set = new Set<string>();
  for (const t of toks) if (RESPONSIBILITY_HINTS.includes(t)) set.add(t);
  return set;
}

export function analyzeJdMatch(resume: ResumeJSON, jd: string): JdMatchReport {
  if (!jd.trim()) {
    return {
      score: 0,
      skillsMatch: 0,
      techMatch: 0,
      responsibilitiesMatch: 0,
      matchedSkills: [],
      missingSkills: [],
      matchedTech: [],
      missingTech: [],
    };
  }

  const jdSkills = extractJdSkills(jd);
  const jdTech = extractJdTech(jd);
  const jdResp = extractJdResponsibilities(jd);

  const rSkills = resumeSkillSet(resume);
  const rText = [
    ...resume.skills.flatMap((g) => g.items),
    ...resume.experience.flatMap((e) => [e.title, ...e.bullets]),
    ...resume.projects.flatMap((p) => [...p.stack, ...p.bullets]),
    resume.summary,
  ].join(" ").toLowerCase();
  const rTech = resumeTechSet(resume);
  const rResp = resumeResponsibilities(resume);

  const matchedSkills = jdSkills.filter((s) => rSkills.has(s) || rText.includes(s));
  const missingSkills = jdSkills.filter((s) => !matchedSkills.includes(s));
  const matchedTech = jdTech.filter((t) => rTech.has(t));
  const missingTech = jdTech.filter((t) => !rTech.has(t));
  const matchedResp = jdResp.filter((t) => rResp.has(t));

  const skillsMatch = jdSkills.length ? Math.round((matchedSkills.length / jdSkills.length) * 100) : 0;
  const techMatch = jdTech.length ? Math.round((matchedTech.length / jdTech.length) * 100) : 0;
  const responsibilitiesMatch = jdResp.length
    ? Math.round((matchedResp.length / jdResp.length) * 100)
    : 0;

  const score = Math.round(skillsMatch * 0.5 + techMatch * 0.3 + responsibilitiesMatch * 0.2);

  return {
    score,
    skillsMatch,
    techMatch,
    responsibilitiesMatch,
    matchedSkills,
    missingSkills,
    matchedTech,
    missingTech,
  };
}
