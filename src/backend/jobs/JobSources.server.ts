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
  const out: RawJob[] = [];
  const seen = new Set<string>();

  for (const start of [0, 25, 50, 75]) {
    const params = new URLSearchParams({
      keywords: role,
      location: location || "Worldwide",
      start: String(start),
    });
    const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${params.toString()}`;
    let res: Response;
    try {
      res = await fetchWithRetry(
        url,
        {
          headers: {
            "User-Agent": pickUA(),
            Accept: "text/html,application/xhtml+xml",
            "Accept-Language": "en-IN,en;q=0.9",
          },
          timeoutMs: 8000,
        },
        { retries: 1, jitterMs: 300 },
      );
    } catch (err) {
      console.warn(`[linkedin:page=${start}] fetch failed:`, (err as Error).message);
      break;
    }
    if (!res.ok) {
      console.warn(`[linkedin:page=${start}] HTTP ${res.status} — stopping pagination`);
      break;
    }
    const html = await res.text();
    let added = 0;
    const cardRegex = /<li[^>]*>([\s\S]*?)<\/li>/g;
    let m: RegExpExecArray | null;
    while ((m = cardRegex.exec(html)) !== null) {
      const card = m[1];
      const hrefMatch = card.match(/href="(https:\/\/[^"]+)"/);
      const titleMatch = card.match(/base-search-card__title[^>]*>\s*([\s\S]*?)\s*</);
      const subtitleMatch = card.match(/base-search-card__subtitle[^>]*>([\s\S]*?)<\/h4>/);
      const locMatch = card.match(/job-search-card__location[^>]*>([\s\S]*?)<\/span>/);
      const dateMatch = card.match(/datetime="([^"]+)"/);
      const seniorityMatch = card.match(/job-search-card__benefits[^>]*>([\s\S]*?)<\/span>/);
      const idMatch =
        card.match(/data-entity-urn="urn:li:jobPosting:(\d+)"/) ||
        hrefMatch?.[1]?.match(/(\d{6,})/);
      if (!titleMatch || !idMatch) continue;
      const id = (idMatch as RegExpMatchArray)[1];
      if (seen.has(id)) continue;
      seen.add(id);
      const title = stripHtml(titleMatch[1]);
      const company = stripHtml(subtitleMatch?.[1] ?? "");
      const loc = stripHtml(locMatch?.[1] ?? location);
      const seniority = stripHtml(seniorityMatch?.[1] ?? "");
      const text = `${title} ${company} ${loc}`;
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
        experience_text: seniority || null,
      });
      added++;
    }
    if (added === 0) break; // no more results
    await new Promise((r) => setTimeout(r, 250));
  }

  if (out.length === 0) {
    console.warn("[linkedin] 0 parseable cards across all pages");
    return out;
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

function naukriHeaders(): Record<string, string> {
  return { ...NAUKRI_HEADERS, "User-Agent": pickUA() };
}

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** HTML fallback: scrape the public listing page when JSON is blocked. */
async function fetchNaukriHtmlFallback(role: string, location: string): Promise<RawJob[]> {
  const slug = `${slugify(role)}-jobs${location ? `-in-${slugify(location)}` : ""}`;
  const url = `https://www.naukri.com/${slug}`;
  try {
    const res = await fetchWithRetry(
      url,
      { headers: { "User-Agent": pickUA(), Accept: "text/html", "Accept-Language": "en-IN,en;q=0.9" }, timeoutMs: 8000 },
      { retries: 1 },
    );
    if (!res.ok) {
      console.warn(`[naukri:html] HTTP ${res.status} — giving up`);
      return [];
    }
    const html = await res.text();
    const out: RawJob[] = [];
    // Naukri renders cards as <article class="jobTuple ...">
    const cardRegex = /<article[^>]*class="[^"]*(?:jobTuple|srp-jobtuple-wrapper)[^"]*"[^>]*>([\s\S]*?)<\/article>/g;
    let m: RegExpExecArray | null;
    let idx = 0;
    while ((m = cardRegex.exec(html)) !== null && out.length < 20) {
      const card = m[1];
      const hrefMatch = card.match(/<a[^>]*class="[^"]*title[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      const companyMatch = card.match(/<a[^>]*class="[^"]*comp-name[^"]*"[^>]*>([\s\S]*?)<\/a>/) || card.match(/<a[^>]*subTitle[^>]*>([\s\S]*?)<\/a>/);
      const expMatch = card.match(/class="[^"]*exp-wrap[^"]*"[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/) || card.match(/class="[^"]*expwdth[^"]*"[^>]*>([\s\S]*?)</);
      const locMatch = card.match(/class="[^"]*loc-wrap[^"]*"[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/) || card.match(/class="[^"]*locWdth[^"]*"[^>]*>([\s\S]*?)</);
      const descMatch = card.match(/class="[^"]*job-desc[^"]*"[^>]*>([\s\S]*?)</);
      if (!hrefMatch) continue;
      const title = stripHtml(hrefMatch[2]);
      if (!title) continue;
      const expText = stripHtml(expMatch?.[1] ?? "");
      const locText = stripHtml(locMatch?.[1] ?? location);
      const desc = stripHtml(descMatch?.[1] ?? "");
      const text = `${title} ${desc} ${locText}`;
      out.push({
        source: "naukri",
        external_id: `naukri-html-${slugify(hrefMatch[1])}-${idx++}`,
        url: hrefMatch[1].startsWith("http") ? hrefMatch[1] : `https://www.naukri.com${hrefMatch[1]}`,
        title,
        company: stripHtml(companyMatch?.[1] ?? "Unknown"),
        location: locText,
        remote: /remote|work from home|wfh/i.test(`${text} ${locText}`),
        description: desc.slice(0, 4000),
        tech_stack: extractTechStack(text),
        salary_min: null,
        salary_max: null,
        salary_currency: "INR",
        posted_at: null,
        experience_text: expText || null,
      });
    }
    return out;
  } catch (err) {
    console.warn("[naukri:html] fallback failed:", (err as Error).message);
    return [];
  }
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
  let res: Response | null = null;
  try {
    res = await fetchWithRetry(
      url,
      { headers: naukriHeaders(), timeoutMs: 8000 },
      { retries: 2, jitterMs: 350 },
    );
  } catch (err) {
    console.warn("[naukri:json] network failed:", (err as Error).message);
  }
  if (!res || !res.ok) {
    if (res) console.warn(`[naukri:json] HTTP ${res.status} — falling back to HTML scrape`);
    return fetchNaukriHtmlFallback(role, location);
  }
  let data: { jobDetails?: Record<string, unknown>[] };
  try {
    data = (await res.json()) as { jobDetails?: Record<string, unknown>[] };
  } catch (err) {
    console.warn("[naukri:json] parse failed:", (err as Error).message);
    return fetchNaukriHtmlFallback(role, location);
  }

  const out: RawJob[] = [];
  for (const o of data.jobDetails ?? []) {
    const text = `${o.title ?? ""} ${o.companyName ?? ""} ${o.jobDescription ?? ""}`;
    const salary = parseNaukriSalary(o);
    const loc = parseNaukriLocation(o) || (typeof location === "string" ? location : "");
    const placeholders = (o.placeholders as NaukriPlaceholder[] | undefined) ?? [];
    const expText = placeholders.find((p) => p.type === "experience")?.label ?? null;
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
      posted_at: typeof o.createdDate === "string" ? o.createdDate : null,
      experience_text: expText,
    });
  }
  if (out.length === 0) {
    console.warn("[naukri:json] empty result — trying HTML fallback");
    return fetchNaukriHtmlFallback(role, location);
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

/* ───────── Foundit (foundit.in — formerly Monster India) ───────── */
export async function fetchFoundit(role: string, location: string): Promise<RawJob[]> {
  const url = `https://www.foundit.in/middleware/jobsearch?sort=1&limit=20&query=${encodeURIComponent(role)}&locations=${encodeURIComponent(location || "")}`;
  let res: Response;
  try {
    res = await fetchWithRetry(
      url,
      {
        headers: {
          "User-Agent": pickUA(),
          Accept: "application/json",
          "Accept-Language": "en-IN,en;q=0.9",
          Referer: "https://www.foundit.in/",
        },
        timeoutMs: 8000,
      },
      { retries: 1, jitterMs: 300 },
    );
  } catch (err) {
    console.warn("[foundit] fetch failed:", (err as Error).message);
    return [];
  }
  if (!res.ok) {
    console.warn(`[foundit] HTTP ${res.status}`);
    return [];
  }
  let data: { jobSearchResponse?: { data?: Record<string, unknown>[] } };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    return [];
  }
  const out: RawJob[] = [];
  for (const o of data.jobSearchResponse?.data ?? []) {
    const title = String((o.title as string) ?? "");
    const company = String((o.companyName as string) ?? "Unknown");
    const locs = Array.isArray(o.locations) ? (o.locations as { label?: string }[]).map((l) => l.label).filter(Boolean).join(", ") : "";
    const desc = stripHtml(String(o.descriptionOrg ?? o.description ?? ""));
    const expText = String((o.experience as string) ?? "");
    const text = `${title} ${company} ${locs} ${desc}`;
    out.push({
      source: "foundit",
      external_id: String(o.jobId ?? o.id ?? `foundit-${Math.random()}`),
      url: String((o.seoJdUrl as string) ?? (o.jobUrl as string) ?? ""),
      title,
      company,
      location: locs || location,
      remote: /remote|work from home|wfh/i.test(text),
      description: desc.slice(0, 4000),
      tech_stack: extractTechStack(text, (o.skillsList as string[]) ?? []),
      salary_min: null,
      salary_max: null,
      salary_currency: "INR",
      posted_at: typeof o.postedOn === "string" ? o.postedOn : null,
      experience_text: expText || null,
    });
  }
  return out;
}

/* ───────── Wellfound (formerly AngelList) ───────── */
export async function fetchWellfound(role: string, location: string): Promise<RawJob[]> {
  // Public listings page; Wellfound has no open API. We parse HTML cards.
  const url = `https://wellfound.com/jobs?role=${encodeURIComponent(role)}&location=${encodeURIComponent(location || "")}`;
  let res: Response;
  try {
    res = await fetchWithRetry(
      url,
      { headers: { "User-Agent": pickUA(), Accept: "text/html", "Accept-Language": "en-US,en;q=0.9" }, timeoutMs: 8000 },
      { retries: 1 },
    );
  } catch (err) {
    console.warn("[wellfound] fetch failed:", (err as Error).message);
    return [];
  }
  if (!res.ok) {
    console.warn(`[wellfound] HTTP ${res.status}`);
    return [];
  }
  const html = await res.text();
  const out: RawJob[] = [];
  // Try Next.js __NEXT_DATA__ first
  const nextData = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextData) {
    try {
      const json = JSON.parse(nextData[1]);
      const jobs: Record<string, unknown>[] = [];
      const walk = (node: unknown): void => {
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node)) { node.forEach(walk); return; }
        const o = node as Record<string, unknown>;
        if (o.title && o.id && (o.startup || o.company || o.companyName)) jobs.push(o);
        for (const v of Object.values(o)) walk(v);
      };
      walk(json);
      for (const o of jobs.slice(0, 20)) {
        const startup = (o.startup ?? o.company) as Record<string, unknown> | undefined;
        const company = String(startup?.name ?? o.companyName ?? "Unknown");
        const title = String(o.title);
        const loc = Array.isArray(o.locationNames) ? (o.locationNames as string[]).join(", ") : (location || "Remote");
        const desc = stripHtml(String(o.description ?? ""));
        const text = `${title} ${company} ${loc} ${desc}`;
        out.push({
          source: "wellfound",
          external_id: String(o.id),
          url: o.slug ? `https://wellfound.com/jobs/${o.id}-${o.slug}` : `https://wellfound.com/jobs/${o.id}`,
          title,
          company,
          location: loc,
          remote: /remote/i.test(text) || Boolean(o.remote),
          description: desc.slice(0, 4000),
          tech_stack: extractTechStack(text),
          salary_min: typeof o.compensation === "object" ? null : null,
          salary_max: null,
          salary_currency: "USD",
          posted_at: typeof o.createdAt === "string" ? o.createdAt : null,
          experience_text: null,
        });
      }
    } catch (err) {
      console.warn("[wellfound] __NEXT_DATA__ parse failed:", (err as Error).message);
    }
  }
  return out;
}

/* ───────── YC / Work at a Startup ───────── */
export async function fetchYC(role: string, location: string): Promise<RawJob[]> {
  // workatastartup.com exposes a JSON-LD list on its jobs page.
  const url = `https://www.workatastartup.com/jobs?query=${encodeURIComponent(role)}`;
  let res: Response;
  try {
    res = await fetchWithRetry(
      url,
      { headers: { "User-Agent": pickUA(), Accept: "text/html" }, timeoutMs: 8000 },
      { retries: 1 },
    );
  } catch (err) {
    console.warn("[yc] fetch failed:", (err as Error).message);
    return [];
  }
  if (!res.ok) {
    console.warn(`[yc] HTTP ${res.status}`);
    return [];
  }
  const html = await res.text();
  const out: RawJob[] = [];
  // Pull every JSON-LD JobPosting block
  const ldRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let m: RegExpExecArray | null;
  while ((m = ldRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1]);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const o of arr) {
        if (!o || o["@type"] !== "JobPosting") continue;
        const title = String(o.title ?? "");
        const company = String(o.hiringOrganization?.name ?? "Unknown");
        const loc = String(o.jobLocation?.address?.addressLocality ?? location ?? "");
        const desc = stripHtml(String(o.description ?? ""));
        const text = `${title} ${company} ${loc} ${desc}`;
        out.push({
          source: "yc",
          external_id: String(o.identifier?.value ?? o.url ?? `yc-${out.length}`),
          url: String(o.url ?? ""),
          title,
          company,
          location: loc,
          remote: /remote/i.test(text) || o.jobLocationType === "TELECOMMUTE",
          description: desc.slice(0, 4000),
          tech_stack: extractTechStack(text),
          salary_min: null,
          salary_max: null,
          salary_currency: "USD",
          posted_at: typeof o.datePosted === "string" ? o.datePosted : null,
          experience_text: typeof o.experienceRequirements === "string" ? o.experienceRequirements : null,
        });
      }
    } catch {
      /* swallow */
    }
  }
  return out;
}

/* ───────── Instahyre (India) ───────── */
export async function fetchInstahyre(role: string, location: string): Promise<RawJob[]> {
  const params = new URLSearchParams({
    job_type: "0",
    company_size: "0",
    sort_by: "relevance",
    page: "1",
    keyword: role,
    location: location || "",
  });
  const url = `https://www.instahyre.com/api/v1/job_search?${params.toString()}`;
  let res: Response;
  try {
    res = await fetchWithRetry(
      url,
      {
        headers: {
          "User-Agent": pickUA(),
          Accept: "application/json",
          "Accept-Language": "en-IN,en;q=0.9",
          Referer: "https://www.instahyre.com/",
        },
        timeoutMs: 8000,
      },
      { retries: 1 },
    );
  } catch (err) {
    console.warn("[instahyre] fetch failed:", (err as Error).message);
    return [];
  }
  if (!res.ok) {
    console.warn(`[instahyre] HTTP ${res.status}`);
    return [];
  }
  let data: { objects?: Record<string, unknown>[] };
  try { data = await res.json() as typeof data; } catch { return []; }
  const out: RawJob[] = [];
  for (const o of data.objects ?? []) {
    const title = String((o.title as string) ?? "");
    const employer = (o.employer ?? {}) as Record<string, unknown>;
    const company = String(employer.company_name ?? "Unknown");
    const loc = Array.isArray(o.locations) ? (o.locations as { city?: string }[]).map((l) => l.city).filter(Boolean).join(", ") : (location ?? "");
    const desc = stripHtml(String(o.public_description ?? o.description ?? ""));
    const text = `${title} ${company} ${loc} ${desc}`;
    out.push({
      source: "instahyre",
      external_id: String(o.id ?? `instahyre-${out.length}`),
      url: o.public_url ? String(o.public_url) : `https://www.instahyre.com/job/${o.id}`,
      title,
      company,
      location: loc || location,
      remote: /remote|work from home|wfh/i.test(text) || Boolean(o.remote),
      description: desc.slice(0, 4000),
      tech_stack: extractTechStack(text, (o.skills as string[]) ?? []),
      salary_min: typeof o.min_ctc === "number" ? (o.min_ctc as number) * 100000 : null,
      salary_max: typeof o.max_ctc === "number" ? (o.max_ctc as number) * 100000 : null,
      salary_currency: "INR",
      posted_at: typeof o.created_on === "string" ? o.created_on : null,
      experience_text: typeof o.min_experience === "number" && typeof o.max_experience === "number"
        ? `${o.min_experience}-${o.max_experience} years`
        : null,
    });
  }
  return out;
}

/* ───────── Hirist (India, tech-only) ───────── */
export async function fetchHirist(role: string, location: string): Promise<RawJob[]> {
  const slug = `${slugify(role)}-jobs${location ? `-in-${slugify(location)}` : ""}`;
  const url = `https://www.hirist.com/${slug}`;
  let res: Response;
  try {
    res = await fetchWithRetry(
      url,
      { headers: { "User-Agent": pickUA(), Accept: "text/html", "Accept-Language": "en-IN,en;q=0.9" }, timeoutMs: 8000 },
      { retries: 1 },
    );
  } catch (err) {
    console.warn("[hirist] fetch failed:", (err as Error).message);
    return [];
  }
  if (!res.ok) {
    console.warn(`[hirist] HTTP ${res.status}`);
    return [];
  }
  const html = await res.text();
  const out: RawJob[] = [];
  // Hirist embeds search results as JSON in __NEXT_DATA__ or window.__INITIAL_STATE__
  const nextData = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextData) {
    try {
      const json = JSON.parse(nextData[1]);
      const jobs: Record<string, unknown>[] = [];
      const walk = (node: unknown): void => {
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node)) { node.forEach(walk); return; }
        const o = node as Record<string, unknown>;
        if (o.jobTitle && o.companyName) jobs.push(o);
        else if (o.title && o.recruiterName) jobs.push(o);
        for (const v of Object.values(o)) walk(v);
      };
      walk(json);
      for (const o of jobs.slice(0, 20)) {
        const title = String(o.jobTitle ?? o.title ?? "");
        const company = String(o.companyName ?? o.recruiterName ?? "Unknown");
        const loc = String(o.location ?? o.jobLocation ?? location ?? "");
        const desc = stripHtml(String(o.jobDescription ?? o.description ?? ""));
        const expText = String(o.experience ?? o.workExperience ?? "");
        const text = `${title} ${company} ${loc} ${desc}`;
        out.push({
          source: "hirist",
          external_id: String(o.jobId ?? o.id ?? `hirist-${out.length}`),
          url: o.jobUrl ? String(o.jobUrl) : `https://www.hirist.com/j/${o.jobId ?? ""}`,
          title,
          company,
          location: loc,
          remote: /remote|work from home|wfh/i.test(text),
          description: desc.slice(0, 4000),
          tech_stack: extractTechStack(text, Array.isArray(o.skills) ? (o.skills as string[]) : []),
          salary_min: null,
          salary_max: null,
          salary_currency: "INR",
          posted_at: typeof o.postedDate === "string" ? o.postedDate : null,
          experience_text: expText || null,
        });
      }
    } catch (err) {
      console.warn("[hirist] __NEXT_DATA__ parse failed:", (err as Error).message);
    }
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
  { id: "naukri",    label: "Naukri",    fetch: fetchNaukri,    requiresKey: false, isAvailable: () => true },
  { id: "linkedin",  label: "LinkedIn",  fetch: fetchLinkedIn,  requiresKey: false, isAvailable: () => true },
  { id: "foundit",   label: "Foundit",   fetch: fetchFoundit,   requiresKey: false, isAvailable: () => true },
  { id: "instahyre", label: "Instahyre", fetch: fetchInstahyre, requiresKey: false, isAvailable: () => true },
  { id: "hirist",    label: "Hirist",    fetch: fetchHirist,    requiresKey: false, isAvailable: () => true },
  { id: "wellfound", label: "Wellfound", fetch: fetchWellfound, requiresKey: false, isAvailable: () => true },
  { id: "yc",        label: "YC Jobs",   fetch: fetchYC,        requiresKey: false, isAvailable: () => true },
  { id: "remoteok",  label: "RemoteOK",  fetch: fetchRemoteOK,  requiresKey: false, isAvailable: () => true },
  { id: "remotive",  label: "Remotive",  fetch: fetchRemotive,  requiresKey: false, isAvailable: () => true },
  { id: "arbeitnow", label: "Arbeitnow", fetch: fetchArbeitnow, requiresKey: false, isAvailable: () => true },
  { id: "indeed",    label: "Indeed (via Adzuna)", fetch: fetchAdzuna, requiresKey: true,
    isAvailable: () => !!process.env.ADZUNA_APP_ID && !!process.env.ADZUNA_APP_KEY },
  { id: "jooble",    label: "Jooble",    fetch: fetchJooble,    requiresKey: true,
    isAvailable: () => !!process.env.JOOBLE_API_KEY },
];


