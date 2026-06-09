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
  /** Optional free-form experience hint from the source (e.g. "2-4 yrs"). */
  experience_text?: string | null;
}

/* ───────── shared retry / UA helpers ───────── */

const UA_POOL = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
];

export function pickUA(): string {
  return UA_POOL[Math.floor(Math.random() * UA_POOL.length)]!;
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
  opts: { retries?: number; jitterMs?: number; retryOn?: number[] } = {},
): Promise<Response> {
  const { retries = 1, jitterMs = 250, retryOn = [401, 403, 408, 425, 429, 500, 502, 503, 504] } = opts;
  const timeoutMs = init.timeoutMs ?? 10_000;
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok || !retryOn.includes(res.status) || i === retries) return res;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (i === retries) throw err;
    }
    await new Promise((r) => setTimeout(r, jitterMs + Math.floor(Math.random() * jitterMs)));
  }
  throw lastErr ?? new Error("fetchWithRetry exhausted");
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
 * jobs search endpoint returns HTML cards that we parse.
 *
 * JD enrichment (B4): after parsing cards, we sequentially fetch each card's
 * full job posting from the guest JD endpoint and replace the placeholder
 * `description` with the real one. The fetch is throttled (≤8 per run, 600ms
 * gap, 5s timeout) and EVERY failure is swallowed — the card always
 * survives with its placeholder description so the pipeline never breaks.
 *
 * Kill-switch: `LINKEDIN_DISABLE_JD_FETCH=1` skips enrichment entirely.
 */

const LINKEDIN_JD_FETCH_MAX = 8;
const LINKEDIN_JD_FETCH_GAP_MS = 600;
const LINKEDIN_JD_FETCH_TIMEOUT_MS = 5000;
const LINKEDIN_PLACEHOLDER_DESCRIPTION = "LinkedIn listing — click through for full job description.";

async function fetchLinkedInJd(id: string): Promise<{ description: string; html: string } | null> {
  const url = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${id}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LINKEDIN_JD_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const html = await res.text();
    const block =
      html.match(/<div[^>]*class="[^"]*description__text[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1] ??
      html.match(/<section[^>]*class="[^"]*show-more-less-html[^"]*"[^>]*>([\s\S]*?)<\/section>/)?.[1] ??
      html;
    const description = stripHtml(block).slice(0, 8000);
    if (description.length < 40) return null;
    return { description, html: block.slice(0, 12000) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

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
      description: LINKEDIN_PLACEHOLDER_DESCRIPTION,
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

  // ── JD enrichment (best-effort, never fails the pipeline) ──
  if (process.env.LINKEDIN_DISABLE_JD_FETCH === "1") return out;
  const toFetch = out.slice(0, LINKEDIN_JD_FETCH_MAX);
  for (const job of toFetch) {
    try {
      const jd = await fetchLinkedInJd(job.external_id);
      if (jd?.description) {
        job.description = jd.description;
        job.tech_stack = Array.from(
          new Set([...job.tech_stack, ...extractTechStack(jd.description)]),
        );
      }
    } catch {
      // Swallow — placeholder description is fine.
    }
    await new Promise((r) => setTimeout(r, LINKEDIN_JD_FETCH_GAP_MS));
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

// All Naukri header magic in one place so spoofing tweaks are obvious.
const NAUKRI_HEADERS: Record<string, string> = {
  "User-Agent": UA,
  Accept: "application/json",
  "App-Id": "109",
  "Content-Type": "application/json",
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  Referer: "https://www.naukri.com/",
  Origin: "https://www.naukri.com",
  systemid: "Naukri",
  clientid: "d3skt0p",
};

interface NaukriPlaceholder {
  type?: string;
  label?: string;
}

function parseNaukriSalary(o: Record<string, unknown>): { min: number | null; max: number | null; currency: string } {
  // Naukri returns salary as a free-form string in placeholders[type=salary].label
  // e.g. "₹ 8-12 Lacs P.A.", "Not disclosed", "$80,000 - $120,000".
  const placeholders = (o.placeholders as NaukriPlaceholder[] | undefined) ?? [];
  const sal = placeholders.find((p) => p.type === "salary")?.label ?? "";
  if (!sal || /not disclosed/i.test(sal)) return { min: null, max: null, currency: "INR" };
  const currency = /\$/.test(sal) ? "USD" : /€/.test(sal) ? "EUR" : /£/.test(sal) ? "GBP" : "INR";
  const lacMultiplier = /lac|lakh/i.test(sal) ? 100000 : /cr/i.test(sal) ? 10000000 : 1;
  const nums = (sal.match(/\d+(?:\.\d+)?/g) ?? []).map(Number).filter((n) => !Number.isNaN(n));
  if (!nums.length) return { min: null, max: null, currency };
  const min = Math.round(nums[0] * lacMultiplier);
  const max = nums.length > 1 ? Math.round(nums[1] * lacMultiplier) : min;
  return { min, max, currency };
}

function parseNaukriLocation(o: Record<string, unknown>): string {
  const placeholders = (o.placeholders as NaukriPlaceholder[] | undefined) ?? [];
  const locs = placeholders
    .filter((p) => p.type === "location")
    .map((p) => p.label?.trim())
    .filter((l): l is string => !!l);
  if (locs.length) return Array.from(new Set(locs)).join(", ");
  // Fallback: any placeholder that looks like a city list.
  const cityLike = placeholders.find((p) => p.label && /,/.test(p.label));
  return cityLike?.label?.trim() ?? "";
}

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
  let res: Response;
  try {
    res = await fetch(url, { headers: NAUKRI_HEADERS });
  } catch (err) {
    // Network error / DNS / TLS — keep pipeline alive.
    console.warn("[naukri] fetch failed:", (err as Error).message);
    return [];
  }
  if (!res.ok) {
    // Anti-bot or rate limit — return empty rather than throwing so the
    // pipeline never dies because Naukri is grumpy.
    console.warn(`[naukri] HTTP ${res.status} — skipping this run`);
    return [];
  }
  let data: { jobDetails?: Record<string, unknown>[] };
  try {
    data = (await res.json()) as { jobDetails?: Record<string, unknown>[] };
  } catch (err) {
    console.warn("[naukri] JSON parse failed:", (err as Error).message);
    return [];
  }

  const out: RawJob[] = [];
  for (const o of data.jobDetails ?? []) {
    const text = `${o.title ?? ""} ${o.companyName ?? ""} ${o.jobDescription ?? ""}`;
    const salary = parseNaukriSalary(o);
    const loc = parseNaukriLocation(o) || (typeof location === "string" ? location : "");
    out.push({
      source: "naukri",
      external_id: String(o.jobId ?? `naukri-${Date.now()}-${out.length}`),
      url: `https://www.naukri.com${(o.jdURL as string) ?? ""}`,
      title: String(o.title ?? ""),
      company: String(o.companyName ?? "Unknown"),
      location: loc,
      remote: /remote|work from home|wfh/i.test(`${text} ${loc}`),
      description: stripHtml(String(o.jobDescription ?? "")).slice(0, 4000),
      tech_stack: extractTechStack(text, (o.tagsAndSkills as string)?.split(",") ?? []),
      salary_min: salary.min,
      salary_max: salary.max,
      salary_currency: salary.currency,
      posted_at: typeof o.footerPlaceholderLabel === "string" ? null : null,
    });
  }
  return out;
}


/* ───────── Jooble (global aggregator; requires API key) ───────── */
export async function fetchJooble(role: string, location: string): Promise<RawJob[]> {
  const key = process.env.JOOBLE_API_KEY;
  if (!key) {
    throw new Error("JOOBLE_API_KEY not configured — set it in Cloud secrets to enable Jooble results");
  }
  const res = await fetch(`https://jooble.org/api/${key}`, {
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ keywords: role, location: location || "", page: "1" }),
  });
  if (!res.ok) throw new Error(`Jooble ${res.status}`);
  const data = (await res.json()) as { jobs?: Record<string, unknown>[] };
  const out: RawJob[] = [];
  for (const o of data.jobs ?? []) {
    const text = `${o.title ?? ""} ${o.company ?? ""} ${o.location ?? ""} ${o.snippet ?? ""}`;
    out.push({
      source: "jooble",
      external_id: String(o.id ?? o.link ?? Math.random()),
      url: String(o.link ?? ""),
      title: String(o.title ?? ""),
      company: String(o.company ?? "Unknown"),
      location: String(o.location ?? ""),
      remote: /remote|work from home|wfh/i.test(text),
      description: stripHtml(String(o.snippet ?? "")).slice(0, 4000),
      tech_stack: extractTechStack(text),
      salary_min: null,
      salary_max: null,
      salary_currency: "USD",
      posted_at: typeof o.updated === "string" ? o.updated : null,
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
  { id: "jooble",    label: "Jooble",    fetch: fetchJooble,    requiresKey: true,
    isAvailable: () => !!process.env.JOOBLE_API_KEY },
  { id: "naukri",    label: "Naukri",    fetch: fetchNaukri,    requiresKey: false, isAvailable: () => true },
];

