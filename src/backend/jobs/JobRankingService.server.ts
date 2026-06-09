/**
 * JobRankingService — title relevance, experience bucket, freshness,
 * location tier, salary penalty. Pure function — no I/O.
 *
 * Rules (Job Discovery Recovery):
 *  - classifyExperience returns ExperienceBucket | null (NEVER defaults to "3-5")
 *  - unknown experience → keep job, small penalty, do not hard-filter
 *  - strict title families: cross-family is a mismatch (heavy penalty + Top-5 ban)
 *  - location tiers: same_city > same_state > remote > same_country > other
 *  - foreign on-site jobs get a severe penalty when user is in India
 *  - freshness curve favors ≤7d, strongly penalizes >30d
 */
import type { RawJob } from "@backend/jobs/JobSources.server";

export type IntelligenceLabel = "high_opportunity" | "strong_match" | "competitive" | "long_shot";
export type ExperienceBucket = "fresher" | "0-2" | "3-5" | "5+";
export type LocationTier = "same_city" | "same_state" | "remote" | "same_country" | "other";

export interface MatchBreakdown {
  title: number;
  skills: number;
  experience: number;
  location: number;
  freshness: number;
  salary: number;
}

export interface RankingResult {
  matchScore: number;
  intelligence: IntelligenceLabel;
  breakdown: MatchBreakdown;
  matchedSkills: string[];
  missingSkills: string[];
  experienceBucket: ExperienceBucket | null;
  locationTier: LocationTier;
  freshnessDays: number;
  isNewToday: boolean;
  titleMismatch: boolean;
  belowSalary: boolean;
  removalReason?: string;
}

export interface CandidateContext {
  role: string;
  skills: string[];
  experience: string;
  experienceBucket?: ExperienceBucket | null;
  location: string;
  desiredSalaryMin?: number | null;
}

/* -------------------- role families -------------------- */

const ROLE_FAMILIES: Record<string, string[]> = {
  frontend:  ["frontend","front end","front-end","react","reactjs","react.js","angular","vue","vuejs","svelte","next.js","nextjs","ui engineer","ui developer","ui/ux engineer","web developer","javascript engineer","js engineer","html","css"],
  backend:   ["backend","back end","back-end","api engineer","node","nodejs","node.js","golang","go engineer","java engineer","python engineer","ruby","rails","django","flask","fastapi","spring","spring boot",".net","c# engineer"],
  fullstack: ["full stack","fullstack","full-stack","mern","mean","mevn"],
  mobile:    ["mobile","ios","android","react native","flutter","swift","kotlin"],
  data:      ["data engineer","data scientist","analytics engineer","etl","data analyst","bi engineer","analytics"],
  ml:        ["ml engineer","machine learning","ai engineer","mlops","deep learning","nlp engineer","computer vision","llm engineer","applied scientist","research scientist"],
  devops:    ["devops","sre","platform engineer","infrastructure","cloud engineer","kubernetes engineer","site reliability"],
  design:    ["designer","ux","ui designer","product designer","visual designer","graphic designer"],
  pm:        ["product manager","program manager","tpm","technical program manager","project manager"],
  marketing: ["marketing","seo","content","copywriter","social media","brand"],
  sales:     ["sales","account executive","bdr","sdr","account manager"],
  qa:        ["qa","sdet","test engineer","automation tester","quality engineer"],
};

export function familyOf(text: string): string | null {
  const t = " " + text.toLowerCase() + " ";
  for (const [fam, terms] of Object.entries(ROLE_FAMILIES)) {
    if (terms.some((kw) => t.includes(kw))) return fam;
  }
  return null;
}

function titleRelevance(jobTitle: string, queryTitle: string): { score: number; mismatch: boolean } {
  const q = (queryTitle || "").trim().toLowerCase();
  if (!q) return { score: 0.6, mismatch: false };

  const queryFam = familyOf(q);
  const jobFam = familyOf(jobTitle);
  const titleLc = jobTitle.toLowerCase();

  if (queryFam && jobFam && queryFam === jobFam) return { score: 1, mismatch: false };
  if (titleLc.includes(q)) return { score: 1, mismatch: false };

  const qTokens = q.split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  const hits = qTokens.filter((t) => titleLc.includes(t)).length;
  const partial = qTokens.length ? hits / qTokens.length : 0;

  // Different families = mismatch (heavy penalty, banned from Top 5).
  if (queryFam && jobFam && queryFam !== jobFam) {
    return { score: partial * 0.2, mismatch: true };
  }
  // Query has a family but job title couldn't be classified — require token overlap.
  if (queryFam && !jobFam) {
    if (partial >= 0.5) return { score: 0.6, mismatch: false };
    return { score: partial * 0.3, mismatch: true };
  }

  if (partial >= 0.5) return { score: 0.7, mismatch: false };
  if (partial > 0)    return { score: 0.4, mismatch: false };
  return { score: 0.3, mismatch: false };
}

/* -------------------- skills -------------------- */

const ALIASES: Record<string, string[]> = {
  react: ["reactjs","react.js"],
  node: ["nodejs","node.js"],
  postgres: ["postgresql"],
  postgresql: ["postgres"],
  javascript: ["js"],
  typescript: ["ts"],
  kubernetes: ["k8s"],
};

function normTxt(v: string): string {
  return v.toLowerCase().replace(/\.js\b/g, "").replace(/[^a-z0-9+#]+/g, " ").trim();
}

function skillHits(skill: string, hay: string): boolean {
  const n = normTxt(skill);
  if (!n) return false;
  if (hay.includes(n)) return true;
  return (ALIASES[n] ?? []).some((a) => hay.includes(a));
}

/* -------------------- experience bucket -------------------- */

/**
 * Returns ExperienceBucket if confidently classifiable, else null.
 * NEVER defaults to "3-5". Unknown is genuinely unknown so the API filter
 * can keep the job rather than dropping it.
 */
export function classifyExperience(title: string, description: string, experienceText?: string | null): ExperienceBucket | null {
  const t = title.toLowerCase();

  // Title-based strong signals
  if (/\b(senior|sr\.?|lead|principal|staff|architect|head of|director|vp|manager)\b/.test(t)) return "5+";
  if (/\b(intern|graduate|fresher|trainee|entry[- ]level|junior|jr\.?)\b/.test(t)) return "fresher";
  if (/\bassociate\b/.test(t)) return "0-2";
  if (/\b(mid[- ]level|mid\b)\b/.test(t)) return "3-5";

  // Explicit experience_text from source (Naukri / LinkedIn / Foundit)
  const sources: string[] = [];
  if (experienceText) sources.push(experienceText.toLowerCase());
  sources.push(description.toLowerCase());

  for (const s of sources) {
    if (/\bfresher\b|\b0\s*(?:-|to)?\s*1\s*(?:year|yr)/i.test(s)) return "fresher";
    // Range form "2-4 years", "3 to 5 yrs"
    const range = s.match(/(\d{1,2})\s*(?:-|to)\s*(\d{1,2})\s*(?:years|yrs)/);
    if (range) {
      const lo = Number(range[1]);
      const hi = Number(range[2]);
      const mid = (lo + hi) / 2;
      if (hi <= 2) return "0-2";
      if (mid <= 2) return "0-2";
      if (mid <= 5) return "3-5";
      return "5+";
    }
    // Single-number "5+ years" or "3 years experience"
    const single = s.match(/(\d{1,2})\+?\s*(?:years|yrs)\s*(?:of\s*)?(?:exp|experience)?/);
    if (single) {
      const yrs = Number(single[1]);
      if (yrs <= 0) return "fresher";
      if (yrs <= 2) return "0-2";
      if (yrs <= 5) return "3-5";
      return "5+";
    }
  }

  return null; // Unknown — caller decides what to do.
}

function bucketRank(b: ExperienceBucket): number {
  return { "fresher": 0, "0-2": 1, "3-5": 2, "5+": 3 }[b];
}

function experienceFit(jobBucket: ExperienceBucket | null, wanted?: ExperienceBucket | null): { score: number; mismatch: boolean } {
  if (!wanted) return { score: 0.7, mismatch: false };
  if (!jobBucket) return { score: 0.5, mismatch: false }; // unknown: small penalty, NOT a mismatch
  if (jobBucket === wanted) return { score: 1, mismatch: false };
  const diff = Math.abs(bucketRank(jobBucket) - bucketRank(wanted));
  return { score: diff === 1 ? 0.45 : 0.15, mismatch: true };
}

/* -------------------- freshness -------------------- */

export function freshnessFromDays(days: number): number {
  if (days <= 1) return 1.0;
  if (days <= 3) return 0.9;
  if (days <= 7) return 0.75;
  if (days <= 14) return 0.55;
  if (days <= 30) return 0.3;
  return 0.08;
}

/* -------------------- location -------------------- */

const IN_CITIES: Record<string, { state: string; country: string }> = {
  hyderabad: { state: "telangana", country: "india" },
  secunderabad: { state: "telangana", country: "india" },
  bangalore: { state: "karnataka", country: "india" },
  bengaluru: { state: "karnataka", country: "india" },
  mumbai: { state: "maharashtra", country: "india" },
  pune: { state: "maharashtra", country: "india" },
  delhi: { state: "delhi", country: "india" },
  "new delhi": { state: "delhi", country: "india" },
  gurgaon: { state: "haryana", country: "india" },
  gurugram: { state: "haryana", country: "india" },
  noida: { state: "uttar pradesh", country: "india" },
  chennai: { state: "tamil nadu", country: "india" },
  kolkata: { state: "west bengal", country: "india" },
  ahmedabad: { state: "gujarat", country: "india" },
  kochi: { state: "kerala", country: "india" },
  trivandrum: { state: "kerala", country: "india" },
  jaipur: { state: "rajasthan", country: "india" },
  indore: { state: "madhya pradesh", country: "india" },
  coimbatore: { state: "tamil nadu", country: "india" },
};

function parseUserLoc(loc: string): { city: string; state: string; country: string } {
  const l = (loc || "").toLowerCase().trim();
  if (!l) return { city: "", state: "", country: "" };
  const hit = IN_CITIES[l];
  if (hit) return { city: l, state: hit.state, country: hit.country };
  // Try matching against any known city substring
  for (const [city, info] of Object.entries(IN_CITIES)) {
    if (l.includes(city)) return { city, state: info.state, country: info.country };
  }
  if (/india/.test(l)) return { city: "", state: "", country: "india" };
  return { city: l, state: "", country: "" };
}

function jobCountry(jobLoc: string): string | null {
  const l = jobLoc.toLowerCase();
  if (/\bindia\b/.test(l)) return "india";
  for (const city of Object.keys(IN_CITIES)) if (l.includes(city)) return "india";
  if (/\busa?\b|united states|new york|san francisco|seattle|austin|chicago|boston/.test(l)) return "usa";
  if (/germany|berlin|munich|hamburg|deutschland/.test(l)) return "germany";
  if (/united kingdom|\buk\b|london|manchester/.test(l)) return "uk";
  if (/canada|toronto|vancouver|montreal/.test(l)) return "canada";
  if (/australia|sydney|melbourne/.test(l)) return "australia";
  return null;
}

function locationTier(job: RawJob, ctx: CandidateContext): { tier: LocationTier; score: number } {
  const userLoc = (ctx.location || "").toLowerCase().trim();
  const jobLoc = (job.location || "").toLowerCase();

  if (!userLoc || userLoc === "remote" || userLoc === "anywhere") {
    if (job.remote) return { tier: "remote", score: 1 };
    return { tier: "other", score: 0.5 };
  }
  const parsed = parseUserLoc(userLoc);
  if (parsed.city && jobLoc.includes(parsed.city)) return { tier: "same_city", score: 1 };
  if (parsed.state && jobLoc.includes(parsed.state)) return { tier: "same_state", score: 0.85 };
  if (job.remote) return { tier: "remote", score: 0.75 };
  if (parsed.country && (jobLoc.includes(parsed.country) || jobCountry(jobLoc) === parsed.country)) {
    return { tier: "same_country", score: 0.5 };
  }
  return { tier: "other", score: 0.1 };
}

/* -------------------- salary -------------------- */

function salaryScore(job: RawJob, wantMin?: number | null): { score: number; below: boolean } {
  if (!wantMin) return { score: 0.7, below: false };
  if (job.salary_min == null && job.salary_max == null) return { score: 0.6, below: false };
  const cmp = job.salary_min ?? job.salary_max ?? 0;
  if (cmp >= wantMin) return { score: 1, below: false };
  return { score: 0.2, below: true };
}

/* -------------------- final -------------------- */

function labelFor(score: number): IntelligenceLabel {
  if (score >= 0.8) return "high_opportunity";
  if (score >= 0.6) return "strong_match";
  if (score >= 0.4) return "competitive";
  return "long_shot";
}

export function rankJob(
  job: RawJob,
  ctx: CandidateContext,
  opts: { sourceConfidence?: number } = {},
): RankingResult {
  const hay = normTxt(`${job.title} ${job.description} ${job.tech_stack.join(" ")}`);

  // title
  const title = titleRelevance(job.title, ctx.role);

  // skills
  const wanted = ctx.skills.map((s) => s.trim()).filter(Boolean);
  const matched: string[] = [];
  const missing: string[] = [];
  for (const s of wanted) (skillHits(s, hay) ? matched : missing).push(s);
  const skills = wanted.length ? matched.length / wanted.length : 0.5;

  // experience — can be null
  const jobBucket = classifyExperience(
    job.title,
    job.description,
    (job as RawJob & { experience_text?: string | null }).experience_text ?? null,
  );
  const exp = experienceFit(jobBucket, ctx.experienceBucket ?? null);

  // location
  const loc = locationTier(job, ctx);

  // freshness
  const days = job.posted_at
    ? Math.max(0, Math.floor((Date.now() - new Date(job.posted_at).getTime()) / 86_400_000))
    : 14;
  const fresh = freshnessFromDays(days);

  // salary
  const sal = salaryScore(job, ctx.desiredSalaryMin ?? null);

  const base =
    0.28 * title.score +
    0.22 * skills +
    0.15 * exp.score +
    0.18 * loc.score +
    0.09 * fresh +
    0.08 * sal.score;

  let multiplier = 1;
  if (title.mismatch) multiplier *= 0.35;
  if (exp.mismatch)   multiplier *= 0.55;

  // Severe penalty: user is in India and job is foreign on-site.
  const parsed = parseUserLoc((ctx.location || "").toLowerCase());
  if (parsed.country === "india" && loc.tier === "other" && !job.remote) {
    multiplier *= 0.25;
  }

  // Source confidence: India-native sources edge out remote boards at equal relevance.
  const conf = typeof opts.sourceConfidence === "number" ? opts.sourceConfidence : 0.8;
  multiplier *= 0.85 + 0.15 * Math.max(0, Math.min(1, conf));

  const matchScore = Math.max(0, Math.min(1, base * multiplier));

  return {
    matchScore,
    intelligence: labelFor(matchScore),
    breakdown: {
      title:      Number(title.score.toFixed(2)),
      skills:     Number(skills.toFixed(2)),
      experience: Number(exp.score.toFixed(2)),
      location:   Number(loc.score.toFixed(2)),
      freshness:  Number(fresh.toFixed(2)),
      salary:     Number(sal.score.toFixed(2)),
    },
    matchedSkills: matched,
    missingSkills: missing,
    experienceBucket: jobBucket,
    locationTier: loc.tier,
    freshnessDays: days,
    isNewToday: days <= 1,
    titleMismatch: title.mismatch,
    belowSalary: sal.below,
  };
}
