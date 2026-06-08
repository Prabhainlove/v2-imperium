/**
 * Profile → Agent Context
 * =======================
 * Builds the *exact* structured payload that the Resume Agent, Cover Letter
 * Agent and Job Match Agent consume. Every downstream generator must read
 * from this object — never from raw form data, never from invented facts.
 *
 * Client-safe (pure functions, no IO). Used by the Profile Preview page so
 * the user sees byte-for-byte what the agents receive.
 */
import type {
  ImperiumProfile,
  ExperienceItem,
  EducationItem,
  ProjectItem,
  CertificationItem,
  LanguageItem,
} from "@backend/ai/AiTypes";

export interface AgentContext {
  personal: {
    name: string;
    email: string;
    phone: string;
    location: string;
    headline: string;
    summary: string;
    links: { linkedin: string; github: string; portfolio: string };
  };
  career: {
    target_role: string;
    seniority: string;
    work_mode: string;
    target_locations: string[];
  };
  skills: string[];
  projects: ProjectItem[];
  experience: ExperienceItem[];
  education: EducationItem[];
  certifications: CertificationItem[];
  languages: LanguageItem[];
  achievements: string[];
  /** Lowercased token vocabulary for hallucination detection. */
  vocabulary: Set<string>;
  /** True when the profile has zero real work experience (fresher mode). */
  is_fresher: boolean;
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function tokensFor(values: Array<string | undefined | null>): string[] {
  const out: string[] = [];
  for (const v of values) {
    if (!v) continue;
    const n = normalize(v);
    if (!n) continue;
    out.push(n);
    // split multi-word skills so "React.js" and "react" both match
    for (const piece of n.split(/[\s,/().+]+/)) {
      const p = piece.trim();
      if (p.length >= 2) out.push(p);
    }
  }
  return out;
}

export function buildAgentContext(profile: Partial<ImperiumProfile> | null | undefined): AgentContext {
  const p = profile ?? {};
  const skills = (p.skills ?? []).filter((s): s is string => typeof s === "string" && s.trim().length > 0);
  const projects = (p.projects ?? []) as ProjectItem[];
  const experience = (p.experience ?? []) as ExperienceItem[];
  const education = (p.education ?? []) as EducationItem[];
  const certs = (p.certifications ?? []) as CertificationItem[];
  const languages = (p.languages ?? []) as LanguageItem[];
  const achievements = (p.achievements ?? []) as string[];

  // Vocabulary: every fact the agents are *allowed* to reference.
  const vocab: string[] = [
    ...tokensFor(skills),
    ...tokensFor(projects.flatMap((pr) => [pr.name, pr.description ?? "", ...(pr.stack ?? []), ...(pr.highlights ?? [])])),
    ...tokensFor(experience.flatMap((e) => [e.title, e.company, e.description ?? "", ...(e.highlights ?? [])])),
    ...tokensFor(education.flatMap((e) => [e.school, e.degree ?? "", e.field ?? ""])),
    ...tokensFor(certs.map((c) => c.name)),
    ...tokensFor(languages.map((l) => l.name)),
    ...tokensFor(achievements),
    ...tokensFor([p.headline, p.summary, p.target_role]),
  ];

  return {
    personal: {
      name: p.name ?? "",
      email: p.email ?? "",
      phone: p.phone ?? "",
      location: p.location ?? "",
      headline: p.headline ?? "",
      summary: p.summary ?? "",
      links: {
        linkedin: p.linkedin_url ?? "",
        github: p.github_url ?? "",
        portfolio: p.portfolio_url ?? "",
      },
    },
    career: {
      target_role: p.target_role ?? "",
      seniority: p.seniority ?? "",
      work_mode: p.work_mode ?? "",
      target_locations: (p.target_locations ?? []) as string[],
    },
    skills,
    projects,
    experience,
    education,
    certifications: certs,
    languages,
    achievements,
    vocabulary: new Set(vocab),
    is_fresher: experience.length === 0,
  };
}

/* ───────── Validation ─────────
 * Reject generated content that references *technologies* not present in the
 * profile. We deliberately scope this to a curated tech-keyword list (not
 * arbitrary English) so the validator does not false-positive on prose.
 */
const TECH_KEYWORDS = [
  "react","next.js","next","vue","angular","svelte","tailwind","redux","zustand",
  "node","node.js","express","nest","nest.js","fastify","django","flask","fastapi","rails","spring","spring boot","laravel","gin","echo",
  "python","javascript","typescript","java","kotlin","swift","go","golang","rust","ruby","php","c++","c#",".net","scala","elixir","dart",
  "postgres","postgresql","mysql","mariadb","mongodb","redis","sqlite","dynamodb","cassandra","neo4j","clickhouse","snowflake","bigquery",
  "aws","gcp","azure","cloudflare","vercel","netlify","heroku","digitalocean",
  "docker","kubernetes","k8s","terraform","ansible","jenkins","github actions","gitlab ci","circleci",
  "graphql","grpc","kafka","rabbitmq","nats","celery","airflow",
  "tensorflow","pytorch","keras","scikit-learn","pandas","numpy","langchain","llamaindex","huggingface","openai","gemini",
  "selenium","playwright","cypress","jest","vitest","mocha","pytest","junit",
  "figma","jira","confluence","notion","postman","linux","bash",
];

export interface ValidationIssue {
  term: string;
  context: string;
}

export interface ValidationReport {
  ok: boolean;
  hallucinated: ValidationIssue[];
}

export function validateAgainstProfile(
  text: string,
  ctx: AgentContext,
): ValidationReport {
  const lower = ` ${text.toLowerCase()} `;
  const allowed = ctx.vocabulary;
  const hallucinated: ValidationIssue[] = [];
  for (const kw of TECH_KEYWORDS) {
    // word-boundary check; tolerate punctuation
    const re = new RegExp(`(^|[^a-z0-9+#.])${kw.replace(/[.+*?^$()|[\]\\]/g, "\\$&")}([^a-z0-9+#.]|$)`, "i");
    if (!re.test(lower)) continue;
    if (allowed.has(kw)) continue;
    // tolerate multi-word kw whose head token IS allowed (e.g. "spring boot" when "spring" is in profile)
    const head = kw.split(/\s+/)[0];
    if (allowed.has(head)) continue;
    // grab a short context snippet
    const idx = lower.indexOf(kw);
    const snippet = text.slice(Math.max(0, idx - 30), Math.min(text.length, idx + kw.length + 30));
    hallucinated.push({ term: kw, context: snippet.trim() });
  }
  return { ok: hallucinated.length === 0, hallucinated };
}

/** Strip lines that reference hallucinated technologies. Last-resort cleanup. */
export function stripHallucinations(text: string, ctx: AgentContext): string {
  const report = validateAgainstProfile(text, ctx);
  if (report.ok) return text;
  const badTerms = new Set(report.hallucinated.map((h) => h.term.toLowerCase()));
  const lines = text.split(/\r?\n/);
  const kept = lines.filter((line) => {
    const l = line.toLowerCase();
    for (const t of badTerms) {
      const re = new RegExp(`(^|[^a-z0-9+#.])${t.replace(/[.+*?^$()|[\]\\]/g, "\\$&")}([^a-z0-9+#.]|$)`);
      if (re.test(l)) return false;
    }
    return true;
  });
  return kept.join("\n");
}
