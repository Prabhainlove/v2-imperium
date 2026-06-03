/**
 * Imperium job discovery adapters. Server-only.
 * Each adapter fetches a public job board API and normalizes the result.
 * Sources that need a key are gracefully skipped (clearly flagged in logs).
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
  "spring","spring boot","hibernate","maven","gradle",
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

const UA =
  "Mozilla/5.0 (compatible; ImperiumJobAgent/1.0; +https://imperium.local)";

/* ───────── RemoteOK ───────── */
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

/* ───────── Remotive ───────── */
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

/* ───────── Arbeitnow ───────── */
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

/* ───────── LinkedIn (guest jobs JSON) ───────── */
/**
 * LinkedIn has no public Jobs API for individual devs. Their public "guest"
 * jobs search endpoint returns HTML cards that we parse. If the endpoint
 * blocks us (anti-bot), we throw and the pipeline logs it cleanly.
 */
export async function fetchLinkedIn(role: string, location: string): Promise<RawJob[]> {
  const params = new URLSearchParams({
    keywords: role,
    location: location || "Worldwide",
    start: "0",
  });
  const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`LinkedIn ${res.status}`);
  const html = await res.text();
  const out: RawJob[] = [];

  // Each card: <li> ... base-card__full-link href="...currentJobId=NNN" ...
  const cardRegex = /<li[^>]*>([\s\S]*?)<\/li>/g;
  let m: RegExpExecArray | null;
  while ((m = cardRegex.exec(html)) !== null) {
    const card = m[1];
    const hrefMatch = card.match(/href="(https:\/\/[^"]+)"/);
    const titleMatch = card.match(/base-search-card__title[^>]*>\s*([\s\S]*?)\s*</);
    const subtitleMatch = card.match(/base-search-card__subtitle[^>]*>([\s\S]*?)<\/h4>/);
    const locMatch = card.match(/job-search-card__location[^>]*>([\s\S]*?)<\/span>/);
    const dateMatch = card.match(/datetime="([^"]+)"/);
    const idMatch =
      card.match(/data-entity-urn="urn:li:jobPosting:(\d+)"/) ||
      hrefMatch?.[1]?.match(/(\d{6,})/);
    if (!titleMatch || !idMatch) continue;
    const title = stripHtml(titleMatch[1]);
    const company = stripHtml(subtitleMatch?.[1] ?? "");
    const loc = stripHtml(locMatch?.[1] ?? location);
    const text = `${title} ${company} ${loc}`;
    if (!matchesQuery(text, role, location)) continue;
    const id = (idMatch as RegExpMatchArray)[1];
    out.push({
      source: "linkedin",
      external_id: String(id),
      url: hrefMatch?.[1] ?? `https://www.linkedin.com/jobs/view/${id}`,
      title,
      company: company || "Unknown",
      location: loc,
      remote: /remote/i.test(loc + " " + title),
      description:
        "LinkedIn listing — click through for full job description.",
      tech_stack: extractTechStack(text),
      salary_min: null,
      salary_max: null,
      salary_currency: "USD",
      posted_at: dateMatch?.[1] ?? null,
    });
  }
  if (out.length === 0) {
    throw new Error("LinkedIn returned 0 parseable cards (blocked or empty)");
  }
  return out;
}

/* ───────── Adzuna (Indeed-class aggregator; requires API key) ───────── */
export async function fetchAdzuna(role: string, location: string): Promise<RawJob[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    throw new Error("ADZUNA_APP_ID/ADZUNA_APP_KEY not configured — set them in Cloud secrets to enable Indeed-class results");
  }
  // Country code: best-effort mapping from location string
  const loc = location.toLowerCase();
  const country =
    /\b(us|usa|united states)\b/.test(loc) ? "us"
    : /india|bangalore|hyderabad|mumbai|delhi|pune|chennai/.test(loc) ? "in"
    : /uk|united kingdom|london/.test(loc) ? "gb"
    : /germany|berlin|munich/.test(loc) ? "de"
    : /canada|toronto|vancouver/.test(loc) ? "ca"
    : /australia|sydney|melbourne/.test(loc) ? "au"
    : "gb";
  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=30&what=${encodeURIComponent(role)}&where=${encodeURIComponent(location)}&content-type=application/json`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`Adzuna ${res.status}`);
  const data = (await res.json()) as { results?: Record<string, unknown>[] };
  const out: RawJob[] = [];
  for (const o of data.results ?? []) {
    const company = (o.company as { display_name?: string } | undefined)?.display_name ?? "Unknown";
    const locName = (o.location as { display_name?: string } | undefined)?.display_name ?? "";
    const text = `${o.title ?? ""} ${company} ${locName} ${o.description ?? ""}`;
    out.push({
      source: "adzuna",
      external_id: String(o.id ?? Math.random()),
      url: String(o.redirect_url ?? ""),
      title: String(o.title ?? ""),
      company,
      location: locName,
      remote: /remote/i.test(text),
      description: stripHtml(String(o.description ?? "")).slice(0, 4000),
      tech_stack: extractTechStack(text),
      salary_min: typeof o.salary_min === "number" ? o.salary_min : null,
      salary_max: typeof o.salary_max === "number" ? o.salary_max : null,
      salary_currency: country.toUpperCase() === "US" ? "USD" : country.toUpperCase() === "IN" ? "INR" : country.toUpperCase() === "GB" ? "GBP" : "EUR",
      posted_at: typeof o.created === "string" ? o.created : null,
    });
  }
  return out;
}

/* ───────── Naukri (best-effort guest search) ───────── */
export async function fetchNaukri(role: string, location: string): Promise<RawJob[]> {
  const params = new URLSearchParams({
    noOfResults: "20",
    urlType: "search_by_keyword",
    searchType: "adv",
    keyword: role,
    location: location || "",
    pageNo: "1",
    k: role,
    seoKey: `${role}-jobs`.replace(/\s+/g, "-").toLowerCase(),
    src: "jobsearchDesk",
    latLong: "",
  });
  const url = `https://www.naukri.com/jobapi/v3/search?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      "App-Id": "109",
      "Content-Type": "application/json",
      "Sec-Fetch-Site": "same-origin",
      Referer: "https://www.naukri.com/",
    },
  });
  if (!res.ok) throw new Error(`Naukri ${res.status} (anti-bot guard)`);
  const data = (await res.json()) as { jobDetails?: Record<string, unknown>[] };
  const out: RawJob[] = [];
  for (const o of data.jobDetails ?? []) {
    const text = `${o.title ?? ""} ${o.companyName ?? ""} ${o.placeholders ?? ""} ${o.jobDescription ?? ""}`;
    out.push({
      source: "naukri",
      external_id: String(o.jobId ?? Math.random()),
      url: `https://www.naukri.com${(o.jdURL as string) ?? ""}`,
      title: String(o.title ?? ""),
      company: String(o.companyName ?? "Unknown"),
      location: String((o.placeholders as { label?: string }[] | undefined)?.find((p) => p.label?.includes(","))?.label ?? ""),
      remote: /remote|work from home|wfh/i.test(text),
      description: stripHtml(String(o.jobDescription ?? "")).slice(0, 4000),
      tech_stack: extractTechStack(text, (o.tagsAndSkills as string)?.split(",") ?? []),
      salary_min: null,
      salary_max: null,
      salary_currency: "INR",
      posted_at: typeof o.footerPlaceholderLabel === "string" ? null : null,
    });
  }
  return out;
}

export type SourceFetcher = (role: string, location: string) => Promise<RawJob[]>;

export interface SourceDescriptor {
  id: string;
  label: string;
  fetch: SourceFetcher;
  requiresKey: boolean;
  /** Lightweight check — when false, source is skipped and logged as unavailable. */
  isAvailable: () => boolean;
}

export const SOURCES: SourceDescriptor[] = [
  { id: "remoteok",  label: "RemoteOK",  fetch: fetchRemoteOK,  requiresKey: false, isAvailable: () => true },
  { id: "remotive",  label: "Remotive",  fetch: fetchRemotive,  requiresKey: false, isAvailable: () => true },
  { id: "arbeitnow", label: "Arbeitnow", fetch: fetchArbeitnow, requiresKey: false, isAvailable: () => true },
  { id: "linkedin",  label: "LinkedIn",  fetch: fetchLinkedIn,  requiresKey: false, isAvailable: () => true },
  { id: "indeed",    label: "Indeed (via Adzuna)", fetch: fetchAdzuna, requiresKey: true,
    isAvailable: () => !!process.env.ADZUNA_APP_ID && !!process.env.ADZUNA_APP_KEY },
  { id: "naukri",    label: "Naukri",    fetch: fetchNaukri,    requiresKey: false, isAvailable: () => true },
];
