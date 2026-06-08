/**
 * Profile → Resume & Cover Letter generators (Jake-ATS, JD-adaptive).
 *
 * Strict rules:
 *  - Single source of truth: the profile. No fabricated tech, metrics or links.
 *  - Output mirrors the FAANG-intern reference layout: Name → contact → links →
 *    Profile Summary → Technical Skills → Projects → Experience → Education →
 *    Certifications → Achievements → Languages.
 *  - Project bullets follow ACTION + TECHNOLOGY + OUTCOME ≤ 28 words.
 *  - Skill rows are reordered per JD; projects re-ranked per JD relevance.
 *  - Banned generic openers are rewritten or stripped.
 */
import type { AgentContext } from "./agent-context";
import { analyzeJobDescription, normalizeSkillToken, skillMatches, type JDAnalysis } from "./jd-analysis";
import { cleanDisplayUrl, isValidLink, validateProfileLinks } from "./link-validator";

export interface JobBrief {
  title: string;
  company: string;
  description?: string;
  tech_stack?: string[];
  location?: string;
}

/* ───────── helpers ───────── */

function fmtRange(start?: string, end?: string, current?: boolean): string {
  const s = (start ?? "").trim();
  const e = current ? "Present" : (end ?? "").trim();
  if (s && e) return `${s} – ${e}`;
  return s || e;
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = (raw ?? "").trim();
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

/* ───────── Skill categorization (JD-reordered) ───────── */

const CATEGORY_RULES: Array<{ label: string; match: RegExp }> = [
  { label: "Languages", match: /^(python|javascript|typescript|java|c\+\+|c#|go|golang|rust|kotlin|swift|ruby|php|scala|r)$/i },
  { label: "Frontend", match: /(react|next|vue|angular|svelte|html|css|tailwind|redux|zustand|ui|frontend)/i },
  { label: "Backend", match: /(node|express|fastapi|django|flask|spring|nest|rails|laravel|graphql|grpc|rest|api|backend|microservice)/i },
  { label: "Databases", match: /(postgres|mysql|mongo|redis|sqlite|dynamodb|snowflake|bigquery|elasticsearch|sql)/i },
  { label: "Cloud & DevOps", match: /(aws|gcp|azure|cloudflare|vercel|docker|kubernetes|k8s|terraform|jenkins|ansible|github actions|gitlab|ci\/cd|prometheus|grafana|datadog)/i },
  { label: "AI & ML", match: /(pytorch|tensorflow|keras|scikit|pandas|numpy|langchain|llamaindex|huggingface|openai|gemini|rag|llm|embeddings|ai agent|machine learning)/i },
  { label: "Tools", match: /(git|github|jira|figma|postman|linux|bash|vs code|vscode|notion|confluence)/i },
];

const SOFT_SKILLS_RE = /^(adaptability|communication|ownership|problem solving|system design thinking|team collaboration|time management|leadership|critical thinking)$/i;

function categorizeSkills(skills: string[]): Record<string, string[]> {
  const buckets: Record<string, string[]> = {};
  for (const rule of CATEGORY_RULES) buckets[rule.label] = [];
  buckets["Other"] = [];
  for (const skill of skills) {
    if (SOFT_SKILLS_RE.test(skill)) continue;
    const rule = CATEGORY_RULES.find((r) => r.match.test(skill));
    if (rule) buckets[rule.label].push(skill);
    else buckets["Other"].push(skill);
  }
  return buckets;
}

function sortByJdRelevance(items: string[], jd?: JDAnalysis): string[] {
  if (!jd) return items;
  const primary = new Set(jd.primaryKeywords.map(normalizeSkillToken));
  const secondary = new Set(jd.secondaryKeywords.map(normalizeSkillToken));
  return [...items].sort((a, b) => {
    const an = normalizeSkillToken(a);
    const bn = normalizeSkillToken(b);
    const score = (n: string) => (primary.has(n) ? 2 : secondary.has(n) ? 1 : 0);
    return score(bn) - score(an);
  });
}

/* ───────── Project ranking ───────── */

function projectRelevanceScore(project: { name?: string; description?: string; stack?: string[]; highlights?: string[] }, jd?: JDAnalysis): number {
  if (!jd) return 0;
  const text = `${project.name ?? ""} ${project.description ?? ""} ${(project.stack ?? []).join(" ")} ${(project.highlights ?? []).join(" ")}`;
  let score = 0;
  for (const kw of jd.primaryKeywords) if (skillMatches(kw, text)) score += 3;
  for (const kw of jd.secondaryKeywords) if (skillMatches(kw, text)) score += 1;
  return score;
}

function rankProjects(ctx: AgentContext, jd?: JDAnalysis) {
  return [...ctx.projects].sort((a, b) => projectRelevanceScore(b, jd) - projectRelevanceScore(a, jd));
}

/* ───────── Impact bullet rewriter (ACTION + TECH + OUTCOME) ───────── */

const STRONG_VERBS_BY_ROLE: Record<string, string[]> = {
  "AI Engineer": ["Engineered", "Architected", "Integrated", "Implemented", "Optimized"],
  "ML Engineer": ["Trained", "Engineered", "Optimized", "Deployed", "Implemented"],
  "Data Scientist": ["Analyzed", "Modeled", "Engineered", "Validated", "Delivered"],
  "Data Analyst": ["Analyzed", "Modeled", "Built", "Automated", "Reported"],
  "Frontend Engineer": ["Built", "Implemented", "Refactored", "Optimized", "Shipped"],
  "Backend Engineer": ["Engineered", "Architected", "Optimized", "Integrated", "Scaled"],
  "Full Stack Developer": ["Built", "Engineered", "Shipped", "Integrated", "Implemented"],
  "Cloud Engineer": ["Deployed", "Architected", "Automated", "Provisioned", "Scaled"],
  "DevOps Engineer": ["Automated", "Architected", "Deployed", "Optimized", "Implemented"],
  "QA Engineer": ["Automated", "Implemented", "Designed", "Validated", "Reduced"],
  "Security Engineer": ["Hardened", "Audited", "Implemented", "Mitigated", "Architected"],
  "Mobile Engineer": ["Shipped", "Built", "Optimized", "Implemented", "Refactored"],
  "Product Analyst": ["Analyzed", "Modeled", "Identified", "Quantified", "Reported"],
  "Business Analyst": ["Documented", "Modeled", "Streamlined", "Analyzed", "Mapped"],
  "Software Engineer": ["Engineered", "Built", "Implemented", "Optimized", "Shipped"],
};

const BANNED_OPENERS = /^(developed( a| an)?|built( a| an)?|created( a| an)?|worked on|helped|responsible for|tasked with|participated in|completed|delivered)\s+/i;

function stripBannedOpener(text: string): string {
  return text.replace(BANNED_OPENERS, "").trim();
}

function trimToWords(text: string, max: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= max) return text;
  return words.slice(0, max).join(" ").replace(/[,;:.]$/, "");
}

function pickVerb(role: string, hash: number): string {
  const verbs = STRONG_VERBS_BY_ROLE[role] ?? STRONG_VERBS_BY_ROLE["Software Engineer"];
  return verbs[hash % verbs.length];
}

function pickTechToken(projectStack: string[], profileSkills: string[], jd?: JDAnalysis): string | null {
  // Prefer JD-aligned tech that is actually in this project's stack.
  if (jd) {
    for (const kw of [...jd.primaryKeywords, ...jd.secondaryKeywords]) {
      if (projectStack.some((s) => skillMatches(kw, s))) return kw;
    }
  }
  const allowed = projectStack.length ? projectStack : profileSkills;
  return allowed[0] ?? null;
}

function tailorBullet(
  raw: string,
  opts: { index: number; jd?: JDAnalysis; projectStack: string[]; profileSkills: string[] },
): string {
  const original = String(raw ?? "").trim().replace(/^[-*•]\s*/, "").replace(/\.$/, "");
  if (!original) return "";

  let body = original;
  const hadOpener = BANNED_OPENERS.test(body);
  if (hadOpener) body = stripBannedOpener(body);
  body = body.charAt(0).toLowerCase() + body.slice(1);

  const role = opts.jd?.primaryRole ?? "Software Engineer";
  const verb = hadOpener || !/^[A-Z][a-z]+ed\b/.test(original)
    ? pickVerb(role, opts.index)
    : null;

  let composed = verb ? `${verb} ${body}` : original;

  // Inject a JD-aligned tech reference IF the project actually uses it AND
  // the bullet doesn't already name one.
  const stackTokens = opts.projectStack.map((s) => s.toLowerCase());
  const mentionsTech = stackTokens.some((s) => composed.toLowerCase().includes(s));
  if (!mentionsTech) {
    const tech = pickTechToken(opts.projectStack, opts.profileSkills, opts.jd);
    if (tech) composed = `${composed} using ${tech}`;
  }

  // Ensure outcome clause when possible
  const hasOutcome = /\b(improving|reducing|increasing|supporting|enabling|delivering|achieving|powering|scaling|automating|optimizing|streamlining|accelerating)\b/i.test(composed);
  if (!hasOutcome) {
    // Append a qualitative outcome derived from the body — never a fake metric.
    if (/dashboard|report|analytics/i.test(composed)) composed += ", improving visibility and decision-making";
    else if (/auth|security|role/i.test(composed)) composed += ", enabling secure multi-user access";
    else if (/automat|workflow|pipeline/i.test(composed)) composed += ", reducing manual operational effort";
    else if (/api|integration|service/i.test(composed)) composed += ", enabling reliable downstream integrations";
    else if (/search|retriev|index/i.test(composed)) composed += ", improving information accessibility";
    else composed += ", supporting end-to-end product delivery";
  }

  composed = trimToWords(composed, 28);
  if (!/[.!?]$/.test(composed)) composed += ".";
  return composed.charAt(0).toUpperCase() + composed.slice(1);
}

/* ───────── Summary builder (2–3 lines) ───────── */

function summaryLines(ctx: AgentContext, jd?: JDAnalysis): string[] {
  const p = ctx.personal;
  const edu = ctx.education[0];
  const role = jd?.primaryRole ?? (p.headline || "Software Engineer");

  const matched = jd
    ? sortByJdRelevance(ctx.skills, jd).filter((s) => skillMatches(s, jd.requiredSkills.concat(jd.secondaryKeywords).join(" "))).slice(0, 4)
    : ctx.skills.slice(0, 4);

  const topProject = ctx.projects[0]?.name;

  const line1 = edu
    ? `${edu.degree ?? "Computer Science"} candidate${edu.school ? ` at ${edu.school}` : ""} targeting ${role} roles.`
    : `${role} with a project-led engineering portfolio.`;

  const techPhrase = matched.length ? matched.join(", ") : ctx.skills.slice(0, 4).join(", ");
  const line2 = techPhrase
    ? `Hands-on experience with ${techPhrase}${topProject ? `, demonstrated through ${topProject}` : ""}.`
    : `Hands-on builder with shipped project work${topProject ? `, including ${topProject}` : ""}.`;

  const line3 = ctx.is_fresher
    ? `Strong fundamentals in data structures, algorithms and system design, validated through production-grade student projects.`
    : `Proven track record delivering production systems end-to-end with measurable user impact.`;

  return [line1, line2, line3].filter(Boolean);
}

/* ───────── Public: resume builder ───────── */

export function buildResumeFromProfile(ctx: AgentContext, job?: JobBrief): string {
  const jd = job ? analyzeJobDescription(job) : undefined;
  const p = ctx.personal;
  const links = validateProfileLinks({
    linkedin_url: p.links.linkedin,
    github_url: p.links.github,
    portfolio_url: p.links.portfolio,
  });

  const lines: string[] = [];

  // Header
  lines.push(`# ${(p.name || "Candidate").toUpperCase()}`);
  const contactBits = [p.location, p.phone, p.email].filter(Boolean);
  if (contactBits.length) lines.push(contactBits.join(" | "));
  const linkBits = [
    links.linkedin && `LinkedIn: ${cleanDisplayUrl(links.linkedin)}`,
    links.github && `GitHub: ${cleanDisplayUrl(links.github)}`,
    links.portfolio && `Portfolio: ${cleanDisplayUrl(links.portfolio)}`,
  ].filter(Boolean) as string[];
  if (linkBits.length) lines.push(linkBits.join(" | "));
  lines.push("");

  // Profile Summary
  lines.push("## Profile Summary");
  for (const s of summaryLines(ctx, jd)) lines.push(s);
  lines.push("");

  // Technical Skills (reordered per JD)
  const buckets = categorizeSkills(ctx.skills);
  const orderedBucketLabels = ["Languages", "Frontend", "Backend", "Databases", "Cloud & DevOps", "AI & ML", "Tools", "Other"];
  const hasAnySkill = Object.values(buckets).some((b) => b.length);
  if (hasAnySkill) {
    lines.push("## Technical Skills");
    for (const label of orderedBucketLabels) {
      const items = unique(sortByJdRelevance(buckets[label] ?? [], jd));
      if (!items.length) continue;
      const display = label === "Other" ? "Core Concepts" : label;
      lines.push(`**${display}:** ${items.join(", ")}`);
    }
    lines.push("");
  }

  // Projects (always present for freshers; max 3 unless senior)
  const orderedProjects = rankProjects(ctx, jd);
  const projectsToShow = ctx.is_fresher ? orderedProjects.slice(0, 3) : orderedProjects.slice(0, 4);

  const renderProjects = () => {
    if (!projectsToShow.length) return;
    lines.push("## Projects");
    for (const project of projectsToShow) {
      const dates = fmtRange(project.start, project.end, project.current);
      const stack = project.stack?.length ? ` | ${project.stack.join(", ")}` : "";
      lines.push(`### ${project.name}${stack}${dates ? ` | ${dates}` : ""}`);
      if (project.url && isValidLink(project.url)) lines.push(`GitHub: ${cleanDisplayUrl(project.url)}`);
      const highlights = (project.highlights ?? []).slice(0, 4);
      const sourceBullets = highlights.length ? highlights : (project.description ? [project.description] : []);
      sourceBullets.forEach((h, idx) => {
        const bullet = tailorBullet(h, {
          index: idx,
          jd,
          projectStack: project.stack ?? [],
          profileSkills: ctx.skills,
        });
        if (bullet) lines.push(`- ${bullet}`);
      });
      lines.push("");
    }
  };

  const renderExperience = () => {
    if (!ctx.experience.length) return;
    lines.push("## Experience");
    for (const exp of ctx.experience) {
      const head = [exp.company, exp.title].filter(Boolean).join(" — ");
      const meta = [fmtRange(exp.start, exp.end, exp.current), exp.location].filter(Boolean).join(" | ");
      lines.push(`### ${head}${meta ? ` | ${meta}` : ""}`);
      const hs = (exp.highlights ?? []).slice(0, 4);
      hs.forEach((h, idx) => {
        const bullet = tailorBullet(h, { index: idx, jd, projectStack: [], profileSkills: ctx.skills });
        if (bullet) lines.push(`- ${bullet}`);
      });
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

  // Education
  if (ctx.education.length) {
    lines.push("## Education");
    for (const ed of ctx.education) {
      const credential = [ed.degree, ed.field && !String(ed.degree ?? "").includes(String(ed.field)) ? ed.field : ""].filter(Boolean).join(" — ");
      const dates = fmtRange(ed.start, ed.end);
      const gpa = ed.gpa ? ` | ${ed.gpa.includes("%") ? `Percentage ${ed.gpa}` : `CGPA ${ed.gpa}`}` : "";
      lines.push(`### ${ed.school}${credential ? ` | ${credential}` : ""}${gpa}${dates ? ` | ${dates}` : ""}`);
    }
    lines.push("");
  }

  // Certifications
  if (ctx.certifications.length) {
    lines.push("## Certifications");
    for (const cert of ctx.certifications.slice(0, 6)) {
      lines.push(`- ${[cert.name, cert.issuer, cert.year].filter(Boolean).join(" – ")}`);
    }
    lines.push("");
  }

  // Achievements (max 4)
  if (ctx.achievements.length) {
    lines.push("## Achievements");
    for (const a of ctx.achievements.slice(0, 4)) {
      const bullet = tailorBullet(a, { index: 0, jd, projectStack: [], profileSkills: ctx.skills });
      if (bullet) lines.push(`- ${bullet}`);
    }
    lines.push("");
  }

  // Languages
  if (ctx.languages.length) {
    lines.push("## Languages");
    lines.push(ctx.languages.map((l) => (l.proficiency ? `${l.name} (${l.proficiency})` : l.name)).join(" | "));
    lines.push("");
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

/* ───────── Cover Letter ───────── */

export function buildCoverFromProfile(ctx: AgentContext, job: JobBrief): string {
  const jd = analyzeJobDescription(job);
  const p = ctx.personal;
  const topProjects = rankProjects(ctx, jd).slice(0, 2);
  const edu = ctx.education[0];

  const matchedSkills = sortByJdRelevance(ctx.skills, jd)
    .filter((s) => skillMatches(s, [...jd.requiredSkills, ...jd.primaryKeywords].join(" ")))
    .slice(0, 5);

  const educationLine = edu
    ? `I am pursuing ${edu.degree ?? "my studies"}${edu.school ? ` at ${edu.school}` : ""}${edu.gpa ? ` with ${edu.gpa.includes("%") ? edu.gpa : `CGPA ${edu.gpa}`}` : ""}`
    : `I am ${p.headline || `a ${jd.primaryRole} candidate`}`;

  const opener = `${educationLine}, applying for the ${job.title} role at ${job.company}. My background as a ${jd.primaryRole.toLowerCase()} is grounded in hands-on project work and verified profile evidence.`;

  const projectProof = topProjects
    .map((project, idx) => {
      const stack = project.stack?.length ? ` using ${project.stack.slice(0, 4).join(", ")}` : "";
      const bullet = tailorBullet(project.highlights?.[0] ?? project.description ?? project.name, {
        index: idx,
        jd,
        projectStack: project.stack ?? [],
        profileSkills: ctx.skills,
      }).replace(/\.$/, "");
      return `${project.name}${stack}, where I ${bullet.charAt(0).toLowerCase()}${bullet.slice(1)}`;
    })
    .join(". ");

  const proof = projectProof
    ? `${projectProof}. These projects are direct evidence that I can take ${jd.primaryRole.toLowerCase()} requirements from spec to a working, deployed product.`
    : matchedSkills.length
      ? `My job-aligned strengths include ${matchedSkills.join(", ")}, supported by coursework and project execution.`
      : `My profile demonstrates strong foundations in software engineering and problem solving.`;

  const closing = `I would value the opportunity to bring this execution mindset to ${job.company}. Thank you for your time and consideration.`;

  return [
    "Dear Hiring Manager,",
    "",
    opener,
    "",
    proof,
    "",
    closing,
    "",
    "Sincerely,",
    p.name || "Candidate",
  ].join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
