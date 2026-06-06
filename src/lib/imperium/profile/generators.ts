/**
 * Profile-first Resume & Cover Letter generators
 * ==============================================
 * Pure, deterministic, profile-driven. No invented experience, no invented
 * tech, no keyword stuffing. Projects are the primary evidence for freshers.
 *
 * These are the *baseline* (fallback) generators used by the pipeline and
 * the resume studio. The Brain layer can optionally rewrite the output, but
 * its output is then validated against the profile vocabulary and rejected
 * if it hallucinates facts.
 *
 * Client-safe: no server imports, no IO.
 */
import type { AgentContext } from "./agent-context";

export interface JobBrief {
  title: string;
  company: string;
  description?: string;
  tech_stack?: string[];
  location?: string;
}

function fmtDate(d?: string): string {
  if (!d) return "";
  return d;
}

function fmtRange(start?: string, end?: string, current?: boolean): string {
  const s = fmtDate(start);
  const e = current ? "Present" : fmtDate(end) || "";
  if (!s && !e) return "";
  if (s && e) return `${s} – ${e}`;
  return s || e;
}

/** Intersect profile skills with job tech-stack, preserving profile casing. */
function alignedSkills(ctx: AgentContext, job: JobBrief): { matched: string[]; rest: string[] } {
  const stack = (job.tech_stack ?? []).map((s) => s.toLowerCase());
  const desc = (job.description ?? "").toLowerCase();
  const matched: string[] = [];
  const rest: string[] = [];
  for (const s of ctx.skills) {
    const ls = s.toLowerCase();
    if (stack.includes(ls) || desc.includes(ls)) matched.push(s);
    else rest.push(s);
  }
  return { matched, rest };
}

/* ───────── Resume ───────── */

export function buildResumeFromProfile(ctx: AgentContext, job?: JobBrief): string {
  const lines: string[] = [];
  const p = ctx.personal;

  // Header
  lines.push(`# ${p.name || "Candidate"}`);
  const contactBits = [p.email, p.phone, p.location].filter(Boolean);
  if (contactBits.length) lines.push(contactBits.join(" · "));
  const linkBits = [
    p.links.linkedin && `LinkedIn: ${p.links.linkedin}`,
    p.links.github && `GitHub: ${p.links.github}`,
    p.links.portfolio && `Portfolio: ${p.links.portfolio}`,
  ].filter(Boolean) as string[];
  if (linkBits.length) lines.push(linkBits.join(" · "));
  lines.push("");

  // Summary — use profile summary as-is. If targeting a job, prepend a single
  // factual alignment sentence (only mentions company + role; no invented claims).
  lines.push("## Summary");
  if (job) {
    lines.push(
      `Targeting ${job.title} at ${job.company}. ${p.summary || p.headline || ""}`.trim(),
    );
  } else if (p.summary) {
    lines.push(p.summary);
  } else if (p.headline) {
    lines.push(p.headline);
  }
  lines.push("");

  // Skills — profile skills, with job-aligned ones first. No invented tech.
  if (ctx.skills.length) {
    lines.push("## Skills");
    const { matched, rest } = job
      ? alignedSkills(ctx, job)
      : { matched: ctx.skills, rest: [] as string[] };
    const ordered = [...matched, ...rest];
    lines.push(ordered.join(", "));
    lines.push("");
  }

  // Projects — primary evidence section. Always before Experience for freshers.
  const showProjectsFirst = ctx.is_fresher;

  const renderProjects = () => {
    if (!ctx.projects.length) return;
    lines.push("## Projects");
    for (const pr of ctx.projects) {
      const head = [pr.name, pr.url ? `(${pr.url})` : ""].filter(Boolean).join(" ");
      lines.push(`**${head}**`);
      if (pr.description) lines.push(pr.description);
      if (pr.stack?.length) lines.push(`*Stack:* ${pr.stack.join(", ")}`);
      for (const h of pr.highlights ?? []) lines.push(`- ${h}`);
      lines.push("");
    }
  };

  const renderExperience = () => {
    if (!ctx.experience.length) return;
    lines.push("## Experience");
    for (const e of ctx.experience) {
      const head = [e.title, e.company].filter(Boolean).join(" — ");
      const meta = [fmtRange(e.start, e.end, e.current), e.location].filter(Boolean).join(" · ");
      lines.push(`**${head}**${meta ? `  \n${meta}` : ""}`);
      if (e.description) lines.push(e.description);
      for (const h of e.highlights ?? []) lines.push(`- ${h}`);
      lines.push("");
    }
  };

  if (showProjectsFirst) {
    renderProjects();
    renderExperience();
  } else {
    renderExperience();
    renderProjects();
  }

  // Education
  if (ctx.education.length) {
    lines.push("## Education");
    for (const ed of ctx.education) {
      const head = [ed.degree, ed.field].filter(Boolean).join(" in ");
      const subhead = [ed.school, fmtRange(ed.start, ed.end)].filter(Boolean).join(" · ");
      lines.push(`**${head || ed.school}**`);
      if (subhead && subhead !== ed.school) lines.push(subhead);
      if (ed.gpa) lines.push(`GPA: ${ed.gpa}`);
      if (ed.description) lines.push(ed.description);
      lines.push("");
    }
  }

  // Certifications
  if (ctx.certifications.length) {
    lines.push("## Certifications");
    for (const c of ctx.certifications) {
      const bits = [c.name, c.issuer, c.year].filter(Boolean).join(" · ");
      lines.push(`- ${bits}`);
    }
    lines.push("");
  }

  // Achievements
  if (ctx.achievements.length) {
    lines.push("## Achievements");
    for (const a of ctx.achievements) lines.push(`- ${a}`);
    lines.push("");
  }

  // Languages
  if (ctx.languages.length) {
    lines.push("## Languages");
    lines.push(
      ctx.languages
        .map((l) => (l.proficiency ? `${l.name} (${l.proficiency})` : l.name))
        .join(", "),
    );
    lines.push("");
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

/* ───────── Cover Letter ───────── */

export function buildCoverFromProfile(ctx: AgentContext, job: JobBrief): string {
  const p = ctx.personal;
  const { matched } = alignedSkills(ctx, job);
  const topProjects = ctx.projects.slice(0, 2);
  const edu = ctx.education[0];

  const intro = `Dear ${job.company} hiring team,`;

  const opener = `I'm writing to apply for the ${job.title} role at ${job.company}.${
    p.headline ? ` I'm ${p.headline.toLowerCase().startsWith("a ") || p.headline.toLowerCase().startsWith("an ") ? "" : "a "}${p.headline}` : ""
  }${edu ? ` currently completing ${edu.degree ?? "studies"}${edu.school ? ` at ${edu.school}` : ""}` : ""}.`;

  const skillsLine = matched.length
    ? `My hands-on work is directly aligned with what your team needs — particularly ${matched.slice(0, 5).join(", ")}.`
    : ctx.skills.length
      ? `My core toolkit covers ${ctx.skills.slice(0, 5).join(", ")}.`
      : "";

  const projectLines = topProjects.map((pr) => {
    const stack = pr.stack?.length ? ` (${pr.stack.slice(0, 4).join(", ")})` : "";
    const first = pr.highlights?.[0] ?? pr.description ?? "";
    return `• **${pr.name}**${stack} — ${first}`;
  });

  const projectsBlock = projectLines.length
    ? ["Selected work that maps to this role:", ...projectLines].join("\n")
    : "";

  const closing = `I'd welcome the chance to discuss how the work above translates into impact at ${job.company}.`;

  const sign = ["Best regards,", p.name || "Candidate"].join("\n");

  return [intro, "", opener, "", skillsLine, "", projectsBlock, "", closing, "", sign]
    .filter((s) => s !== null && s !== undefined)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim() + "\n";
}
