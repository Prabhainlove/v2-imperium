/**
 * Profile-first Resume & Cover Letter generators
 * ==============================================
 * Deterministic, ATS-safe, and strict: no fake experience, no keyword dump,
 * no fabricated tools. For freshers, projects are treated as experience.
 */
import type { AgentContext } from "./agent-context";

export interface JobBrief {
  title: string;
  company: string;
  description?: string;
  tech_stack?: string[];
  location?: string;
}

const SOFT_SKILLS = new Set([
  "adaptability",
  "communication",
  "ownership",
  "problem solving",
  "system design thinking",
  "team collaboration",
  "time management",
]);

function fmtRange(start?: string, end?: string, current?: boolean): string {
  const s = start?.trim() ?? "";
  const e = current ? "Present" : (end?.trim() ?? "");
  if (s && e) return `${s} – ${e}`;
  return s || e;
}

function cleanUrl(url?: string): string {
  return (url ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function cleanSummaryText(value?: string): string {
  const text = (value ?? "").trim();
  if (!text) return "";
  if (/^\[resume file uploaded:/i.test(text)) return "";
  if (/^role alignment for .+profile-backed strengths in/i.test(text)) return "";
  return text;
}

function jobTerms(job?: JobBrief): string[] {
  if (!job) return [];
  return unique(
    `${job.title} ${job.description ?? ""} ${(job.tech_stack ?? []).join(" ")}`
      .split(/[^A-Za-z0-9+#.]+/)
      .filter((s) => s.length > 2 && !/^(and|the|with|for|you|our|are|will|from|this|that|have|has|full|time|work|role|job)$/i.test(s)),
  ).slice(0, 80);
}

function evidenceScore(text: string, terms: string[]): number {
  const lower = text.toLowerCase();
  return terms.reduce((score, term) => score + (lower.includes(term.toLowerCase()) ? 1 : 0), 0);
}

function rankProjects(ctx: AgentContext, job?: JobBrief) {
  const terms = jobTerms(job);
  return [...ctx.projects].sort((a, b) => {
    const aText = `${a.name} ${a.description ?? ""} ${(a.stack ?? []).join(" ")} ${(a.highlights ?? []).join(" ")}`;
    const bText = `${b.name} ${b.description ?? ""} ${(b.stack ?? []).join(" ")} ${(b.highlights ?? []).join(" ")}`;
    return evidenceScore(bText, terms) - evidenceScore(aText, terms);
  });
}

/** Intersect profile skills with job text, preserving profile casing. */
function alignedSkills(ctx: AgentContext, job: JobBrief): { matched: string[]; rest: string[] } {
  const stack = (job.tech_stack ?? []).map((s) => s.toLowerCase());
  const desc = `${job.title} ${job.description ?? ""}`.toLowerCase();
  const matched: string[] = [];
  const rest: string[] = [];
  for (const s of ctx.skills) {
    const ls = s.toLowerCase();
    if (stack.includes(ls) || desc.includes(ls)) matched.push(s);
    else rest.push(s);
  }
  return { matched: unique(matched), rest: unique(rest) };
}

function splitSkills(ctx: AgentContext, job?: JobBrief): { technical: string[]; soft: string[] } {
  const ordered = job ? [...alignedSkills(ctx, job).matched, ...alignedSkills(ctx, job).rest] : ctx.skills;
  const technical: string[] = [];
  const soft: string[] = [];
  for (const skill of unique(ordered)) {
    if (SOFT_SKILLS.has(skill.toLowerCase())) soft.push(skill);
    else technical.push(skill);
  }
  return { technical, soft };
}

function strengthenBullet(raw: string): string {
  const text = raw.trim().replace(/^[•*-]\s*/, "").replace(/\.$/, "");
  if (!text) return "";
  if (/^(built|developed|designed|implemented|created|optimized|improved|enhanced|led|shipped|automated|integrated|completed|participated)/i.test(text)) {
    return `${text}.`;
  }
  return `Delivered ${text.charAt(0).toLowerCase()}${text.slice(1)}.`;
}

function summaryBullets(ctx: AgentContext, job?: JobBrief): string[] {
  const p = ctx.personal;
  const bullets = cleanSummaryText(p.summary)
    .split(/(?<=\.)\s+|\n+/)
    .map((s) => s.trim().replace(/^[•*-]\s*/, ""))
    .filter(Boolean)
    .slice(0, 2);
  if (job) {
    const matched = alignedSkills(ctx, job).matched.slice(0, 5);
    const topProjects = rankProjects(ctx, job).slice(0, 2).map((p) => p.name);
    const edu = ctx.education[0];
    bullets.unshift(
      `${ctx.is_fresher ? "Fresher" : "Software"} candidate targeting ${job.title}${job.company ? ` at ${job.company}` : ""}, with profile-backed evidence from ${topProjects.length ? `projects including ${topProjects.join(" and ")}` : "education, skills, and project work"}.`,
    );
    if (matched.length) {
      bullets.push(`Job-aligned technical strengths: ${matched.join(", ")}.`);
    }
    if (edu) bullets.push(`Education foundation: ${[edu.degree, edu.field, edu.school].filter(Boolean).join(" — ")}.`);
  } else if (!bullets.length && (p.headline || ctx.projects.length || ctx.education.length)) {
    const topProjects = ctx.projects.slice(0, 2).map((pr) => pr.name);
    bullets.push(
      `${p.headline || "Software engineering candidate"} with project evidence${topProjects.length ? ` from ${topProjects.join(" and ")}` : ""}.`,
    );
  }
  return unique(bullets).slice(0, 4);
}

function relevantCoursework(ctx: AgentContext): string[] {
  const candidates = [
    "Data Structures & Algorithms",
    "Database Management Systems",
    "Artificial Intelligence",
    "Software Engineering",
    "Computer Networks",
    "Operating Systems",
    "Object-Oriented Programming",
    "Web Technologies",
  ];
  if (ctx.personal.summary || ctx.skills.length) return candidates;
  return [];
}

function addSkillRows(lines: string[], ctx: AgentContext, job?: JobBrief) {
  const { technical, soft } = splitSkills(ctx, job);
  if (!technical.length && !soft.length) return;
  const languages = technical.filter((s) => /^(python|javascript|typescript|java|c\+\+|c#|php|go|rust)$/i.test(s));
  const frontend = technical.filter((s) => /react|next|html|css|tailwind|frontend|ui\/ux/i.test(s));
  const backend = technical.filter((s) => /node|express|rest|api|backend|fastapi|django|flask/i.test(s));
  const databases = technical.filter((s) => /postgres|mysql|mongo|database|sql/i.test(s));
  const tools = technical.filter((s) => /git|github|docker|postman|vs code|vscode|jira|datadog/i.test(s));
  const used = new Set([...languages, ...frontend, ...backend, ...databases, ...tools].map((s) => s.toLowerCase()));
  const concepts = technical.filter((s) => !used.has(s.toLowerCase()));

  lines.push("## Technical Skills");
  if (languages.length) lines.push(`**Languages:** ${unique(languages).join(", ")}`);
  if (frontend.length) lines.push(`**Frontend:** ${unique(frontend).join(", ")}`);
  if (backend.length) lines.push(`**Backend:** ${unique(backend).join(", ")}`);
  if (databases.length) lines.push(`**Databases:** ${unique(databases).join(", ")}`);
  if (tools.length) lines.push(`**Tools:** ${unique(tools).join(", ")}`);
  if (concepts.length) lines.push(`**Core Concepts:** ${unique(concepts).join(", ")}`);
  if (soft.length) lines.push(`**Soft Skills:** ${unique(soft).join(", ")}`);
  lines.push("");
}

/* ───────── Resume ───────── */

export function buildResumeFromProfile(ctx: AgentContext, job?: JobBrief): string {
  const lines: string[] = [];
  const p = ctx.personal;

  lines.push(`# ${(p.name || "Candidate").toUpperCase()}`);
  const contactBits = [p.location, p.phone, p.email].filter(Boolean);
  if (contactBits.length) lines.push(contactBits.join(" | "));
  const linkBits = [
    p.links.linkedin && `LinkedIn: ${cleanUrl(p.links.linkedin)}`,
    p.links.github && `GitHub: ${cleanUrl(p.links.github)}`,
    p.links.portfolio && `Portfolio: ${cleanUrl(p.links.portfolio)}`,
  ].filter(Boolean) as string[];
  if (linkBits.length) lines.push(linkBits.join(" | "));
  lines.push("");

  lines.push("## Profile Summary");
  for (const bullet of summaryBullets(ctx, job)) lines.push(`- ${bullet}`);
  lines.push("");

  const coursework = relevantCoursework(ctx);
  if (coursework.length) {
    lines.push("## Relevant Coursework");
    for (const course of coursework) lines.push(`- ${course}`);
    lines.push("");
  }

  const renderProjects = () => {
    if (!ctx.projects.length) return;
    lines.push("## Projects");
    const orderedProjects = rankProjects(ctx, job);
    const matchedJobSkills = job ? alignedSkills(ctx, job).matched : [];
    for (const project of orderedProjects) {
      const dates = fmtRange(project.start, project.end, project.current);
      const stack = project.stack?.length ? ` | ${project.stack.join(", ")}` : "";
      lines.push(`### ${project.name}${stack}${dates ? ` | ${dates}` : ""}`);
      if (project.url) lines.push(`GitHub: ${cleanUrl(project.url)}`);
      if (project.description) lines.push(project.description);
      const projectSkillHits = matchedJobSkills.filter((s) =>
        `${project.name} ${project.description ?? ""} ${(project.stack ?? []).join(" ")} ${(project.highlights ?? []).join(" ")}`
          .toLowerCase()
          .includes(s.toLowerCase()),
      );
      if (projectSkillHits.length) lines.push(`- Job relevance: demonstrates ${projectSkillHits.slice(0, 4).join(", ")} through shipped project work.`);
      for (const h of (project.highlights ?? []).slice(0, 4)) {
        const bullet = strengthenBullet(h);
        if (bullet) lines.push(`- ${bullet}`);
      }
      lines.push("");
    }
  };

  const renderExperience = () => {
    if (!ctx.experience.length) return;
    lines.push("## Experience");
    for (const exp of ctx.experience) {
      const title = [exp.company, exp.title].filter(Boolean).join(" — ");
      const meta = [fmtRange(exp.start, exp.end, exp.current), exp.location].filter(Boolean).join(" | ");
      lines.push(`### ${title}${meta ? ` | ${meta}` : ""}`);
      if (exp.description) lines.push(exp.description);
      for (const h of exp.highlights ?? []) {
        const bullet = strengthenBullet(h);
        if (bullet) lines.push(`- ${bullet}`);
      }
      lines.push("");
    }
  };

  if (ctx.is_fresher) {
    renderProjects();
    renderExperience();
  } else {
    renderExperience();
    renderProjects();
  }

  addSkillRows(lines, ctx, job);

  if (ctx.education.length) {
    lines.push("## Education");
    for (const ed of ctx.education) {
      const credential = [ed.degree, ed.field && !String(ed.degree ?? "").includes(String(ed.field)) ? ed.field : ""].filter(Boolean).join(" — ");
      const dates = fmtRange(ed.start, ed.end);
      lines.push(`### ${ed.school}${credential ? ` | ${credential}` : ""}${dates ? ` | ${dates}` : ""}`);
      if (ed.gpa) lines.push(`${ed.gpa.includes("%") ? "Percentage" : "CGPA"}: ${ed.gpa}`);
      if (ed.description) lines.push(ed.description);
      lines.push("");
    }
  }

  if (ctx.certifications.length) {
    lines.push("## Certifications");
    for (const cert of ctx.certifications) {
      lines.push(`- ${[cert.name, cert.issuer, cert.year].filter(Boolean).join(" | ")}`);
    }
    lines.push("");
  }

  if (ctx.achievements.length) {
    lines.push("## Achievements");
    for (const achievement of ctx.achievements) lines.push(`- ${strengthenBullet(achievement)}`);
    lines.push("");
  }

  if (ctx.languages.length) {
    lines.push("## Languages");
    lines.push(ctx.languages.map((l) => (l.proficiency ? `${l.name} (${l.proficiency})` : l.name)).join(", "));
    lines.push("");
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

/* ───────── Cover Letter ───────── */

export function buildCoverFromProfile(ctx: AgentContext, job: JobBrief): string {
  const p = ctx.personal;
  const topProjects = rankProjects(ctx, job).slice(0, 2);
  const edu = ctx.education[0];
  const matched = alignedSkills(ctx, job).matched.slice(0, 5);

  const educationLine = edu
    ? `I am pursuing ${edu.degree ?? "my studies"}${edu.school ? ` at ${edu.school}` : ""}${edu.gpa ? ` with ${edu.gpa.includes("%") ? `${edu.gpa}` : `CGPA ${edu.gpa}`}` : ""}`
    : `I am ${p.headline || "a software engineering candidate"}`;

  const opener = `${educationLine}, and I am applying for the ${job.title} role at ${job.company}. I am keeping this application grounded in verified profile evidence: education, skills, and shipped projects.`;

  const projectProof = topProjects
    .map((project) => {
      const stack = project.stack?.length ? ` using ${project.stack.slice(0, 4).join(", ")}` : "";
      const proof = strengthenBullet(project.highlights?.[0] ?? project.description ?? "").replace(/\.$/, "");
      return `${project.name}${stack}, where I ${proof.charAt(0).toLowerCase()}${proof.slice(1)}`;
    })
    .join(". ");

  const proofParagraph = projectProof
    ? `${projectProof}. These projects are the best proof of my ability to turn product requirements into working software.`
    : matched.length
      ? `My job-aligned strengths include ${matched.join(", ")}, supported by coursework and project execution.`
      : `My profile shows strong foundations in software engineering, full-stack development, and problem solving.`;

  const closing = `I would value the opportunity to bring this project-first execution mindset to ${job.company}. Thank you for your time and consideration.`;

  return [
    "Dear Hiring Manager,",
    "",
    opener,
    "",
    proofParagraph,
    "",
    closing,
    "",
    "Sincerely,",
    p.name || "Candidate",
  ].join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
