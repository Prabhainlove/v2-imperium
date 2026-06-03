/**
 * Imperium job discovery adapters. Server-only.
 * Each adapter fetches a public job board API and normalizes the result.
 */

export interface RawJob {
  source: string;
  external_id: string;
  url: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  description: string;
  tech_stack: string[];
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  posted_at: string | null;
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesQuery(text: string, role: string, location: string): boolean {
  const t = text.toLowerCase();
  const role_terms = role.toLowerCase().split(/\s+/).filter(Boolean);
  const hit_role = role_terms.length === 0 || role_terms.some((r) => t.includes(r));
  const loc = location.toLowerCase().trim();
  if (!loc || loc === "remote" || loc === "anywhere" || loc === "worldwide") return hit_role;
  return hit_role && (t.includes(loc) || t.includes("remote") || t.includes("anywhere"));
}

const COMMON_TAGS = [
  "python","typescript","javascript","react","vue","angular","node","fastapi","django","flask",
  "pytorch","tensorflow","keras","langchain","llm","llms","openai","anthropic","rag",
  "sql","postgres","mysql","mongodb","redis","kafka","spark",
  "aws","gcp","azure","docker","kubernetes","terraform",
  "ml","ai","nlp","computer vision","data science",
  "go","golang","rust","java","kotlin","scala","c++","c#",
  "graphql","rest","grpc",
];

function extractTechStack(text: string, declared: string[] = []): string[] {
  const t = text.toLowerCase();
  const found = new Set<string>();
  for (const d of declared) {
    const v = d.toString().trim();
    if (v) found.add(v.toLowerCase());
  }
  for (const tag of COMMON_TAGS) {
    if (t.includes(tag)) found.add(tag);
  }
  return Array.from(found).slice(0, 20);
}

const UA = "Imperium-JobAgent/1.0 (+https://imperium.local)";

export async function fetchRemoteOK(role: string, location: string): Promise<RawJob[]> {
  const res = await fetch("https://remoteok.com/api", {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`RemoteOK ${res.status}`);
  const data = (await res.json()) as unknown[];
  const jobs: RawJob[] = [];
  for (const item of data) {
    const o = item as Record<string, unknown>;
    if (!o.id || !o.position) continue;
    const text = `${o.position ?? ""} ${o.company ?? ""} ${o.location ?? ""} ${o.description ?? ""} ${(o.tags as string[] | undefined)?.join(" ") ?? ""}`;
    if (!matchesQuery(text, role, location)) continue;
    const desc = stripHtml(String(o.description ?? ""));
    jobs.push({
      source: "remoteok",
      external_id: String(o.id),
      url: String(o.url ?? `https://remoteok.com/remote-jobs/${o.id}`),
      title: String(o.position),
      company: String(o.company ?? "Unknown"),
      location: String(o.location ?? "Remote"),
      remote: true,
      description: desc.slice(0, 4000),
      tech_stack: extractTechStack(text, (o.tags as string[]) ?? []),
      salary_min: typeof o.salary_min === "number" ? o.salary_min : null,
      salary_max: typeof o.salary_max === "number" ? o.salary_max : null,
      salary_currency: "USD",
      posted_at: typeof o.date === "string" ? o.date : null,
    });
  }
  return jobs;
}

export async function fetchRemotive(role: string, location: string): Promise<RawJob[]> {
  const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(role)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Remotive ${res.status}`);
  const data = (await res.json()) as { jobs?: Record<string, unknown>[] };
  const out: RawJob[] = [];
  for (const o of data.jobs ?? []) {
    const text = `${o.title ?? ""} ${o.company_name ?? ""} ${o.candidate_required_location ?? ""} ${o.description ?? ""} ${(o.tags as string[] | undefined)?.join(" ") ?? ""}`;
    if (!matchesQuery(text, role, location)) continue;
    out.push({
      source: "remotive",
      external_id: String(o.id),
      url: String(o.url ?? ""),
      title: String(o.title ?? ""),
      company: String(o.company_name ?? "Unknown"),
      location: String(o.candidate_required_location ?? "Remote"),
      remote: true,
      description: stripHtml(String(o.description ?? "")).slice(0, 4000),
      tech_stack: extractTechStack(text, (o.tags as string[]) ?? []),
      salary_min: null,
      salary_max: null,
      salary_currency: "USD",
      posted_at: typeof o.publication_date === "string" ? o.publication_date : null,
    });
  }
  return out;
}

export async function fetchArbeitnow(role: string, location: string): Promise<RawJob[]> {
  const res = await fetch("https://www.arbeitnow.com/api/job-board-api", {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`Arbeitnow ${res.status}`);
  const data = (await res.json()) as { data?: Record<string, unknown>[] };
  const out: RawJob[] = [];
  for (const o of data.data ?? []) {
    const text = `${o.title ?? ""} ${o.company_name ?? ""} ${o.location ?? ""} ${o.description ?? ""} ${(o.tags as string[] | undefined)?.join(" ") ?? ""}`;
    if (!matchesQuery(text, role, location)) continue;
    out.push({
      source: "arbeitnow",
      external_id: String(o.slug ?? o.url ?? Math.random()),
      url: String(o.url ?? ""),
      title: String(o.title ?? ""),
      company: String(o.company_name ?? "Unknown"),
      location: String(o.location ?? ""),
      remote: Boolean(o.remote),
      description: stripHtml(String(o.description ?? "")).slice(0, 4000),
      tech_stack: extractTechStack(text, (o.tags as string[]) ?? []),
      salary_min: null,
      salary_max: null,
      salary_currency: "EUR",
      posted_at:
        typeof o.created_at === "number"
          ? new Date(o.created_at * 1000).toISOString()
          : null,
    });
  }
  return out;
}

export type SourceFetcher = (role: string, location: string) => Promise<RawJob[]>;

export const SOURCES: { id: string; label: string; fetch: SourceFetcher }[] = [
  { id: "remoteok", label: "RemoteOK", fetch: fetchRemoteOK },
  { id: "remotive", label: "Remotive", fetch: fetchRemotive },
  { id: "arbeitnow", label: "Arbeitnow", fetch: fetchArbeitnow },
];
