/**
 * JobRankingService — title relevance, experience bucket, freshness,
 * location tier, salary penalty. Pure function — no I/O.
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
  experienceBucket: ExperienceBucket;
  locationTier: LocationTier;
  freshnessDays: number;
  isNewToday: boolean;
  titleMismatch: boolean;
  belowSalary: boolean;
}

export interface CandidateContext {
  role: string;
  skills: string[];
  experience: string;            // raw text from form, kept for back-compat
  experienceBucket?: ExperienceBucket | null;
  location: string;
  desiredSalaryMin?: number | null;
}

/* -------------------- role families / title relevance -------------------- */

const ROLE_FAMILIES: Record<string, string[]> = {
  frontend:  ["frontend","front end","front-end","react","reactjs","angular","vue","svelte","ui engineer","ui developer","web developer","javascript engineer","js engineer"],
  backend:   ["backend","back end","back-end","api engineer","node","nodejs","golang","go engineer","java engineer","python engineer","ruby","rails","django","spring"],
  fullstack: ["full stack","fullstack","full-stack","mern","mean"],
  mobile:    ["mobile","ios","android","react native","flutter","swift","kotlin"],
  data:      ["data engineer","data scientist","analytics engineer","etl","data analyst"],
  ml:        ["ml engineer","machine learning","ai engineer","mlops","deep learning","nlp engineer"],
  devops:    ["devops","sre","platform engineer","infrastructure","cloud engineer","kubernetes engineer"],
  design:    ["designer","ux","ui designer","product designer","visual designer"],
  pm:        ["product manager","program manager","tpm"],
  marketing: ["marketing","seo","content","copywriter","social media"],
  sales:     ["sales","account executive","bdr","sdr"],
  qa:        ["qa","sdet","test engineer","automation tester"],
};

function familyOf(text: string): string | null {
  const t = text.toLowerCase();
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

  // Direct phrase / family-keyword hit
  if (queryFam && jobFam && queryFam === jobFam) return { score: 1, mismatch: false };

  // exact substring of the query in title
  if (titleLc.includes(q)) return { score: 1, mismatch: false };

  // token overlap (ignore very short tokens)
  const qTokens = q.split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  const hits = qTokens.filter((t) => titleLc.includes(t)).length;
  const partial = qTokens.length ? hits / qTokens.length : 0;

  // Different identified family → mismatch
  if (queryFam && jobFam && queryFam !== jobFam) {
    return { score: partial * 0.3, mismatch: true };
  }

  if (partial >= 0.5) return { score: 0.7, mismatch: false };
  if (partial > 0)    return { score: 0.4, mismatch: false };
  // No family on query → neutral, no mismatch flag
  return { score: queryFam ? 0.15 : 0.4, mismatch: Boolean(queryFam) };
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

export function classifyExperience(title: string, description: string): ExperienceBucket {
  const t = title.toLowerCase();
  if (/\b(senior|sr\.?|lead|principal|staff|architect|head of|director|vp|manager)\b/.test(t)) return "5+";
  if (/\b(intern|graduate|fresher|trainee|entry[- ]level|junior|jr\.?)\b/.test(t)) return "fresher";
  if (/\b(mid|mid[- ]level|ii\b|iii\b)\b/.test(t)) return "3-5";
  if (/\bassociate\b/.test(t)) return "0-2";

  const d = description.toLowerCase();
  const m = d.match(/(\d{1,2})\+?\s*(?:to\s*\d{1,2}\s*)?(?:years|yrs)/);
  if (m) {
    const yrs = Number(m[1]);
    if (yrs <= 0) return "fresher";
    if (yrs <= 2) return "0-2";
    if (yrs <= 5) return "3-5";
    return "5+";
  }
  return "3-5";
}

function bucketRank(b: ExperienceBucket): number {
  return { "fresher": 0, "0-2": 1, "3-5": 2, "5+": 3 }[b];
}

function experienceFit(jobBucket: ExperienceBucket, wanted?: ExperienceBucket | null): number {
  if (!wanted) return 0.7;
  if (jobBucket === wanted) return 1;
  const diff = Math.abs(bucketRank(jobBucket) - bucketRank(wanted));
  return diff === 1 ? 0.6 : 0.3;
}

/* -------------------- freshness -------------------- */

export function freshnessFromDays(days: number): number {
  if (days <= 0) return 1;
  if (days === 1) return 0.95;
  if (days <= 3) return 0.85;
  if (days <= 7) return 0.7;
  if (days <= 14) return 0.5;
  if (days <= 30) return 0.3;
  return 0.1;
}

/* -------------------- location -------------------- */

const IN_CITIES: Record<string, { state: string; country: string }> = {
  hyderabad: { state: "telangana", country: "india" },
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
};

function parseUserLoc(loc: string): { city: string; state: string; country: string } {
  const l = (loc || "").toLowerCase().trim();
  if (!l) return { city: "", state: "", country: "" };
  const hit = IN_CITIES[l];
  if (hit) return { city: l, state: hit.state, country: hit.country };
  return { city: l, state: "", country: "" };
}

function locationTier(job: RawJob, ctx: CandidateContext): { tier: LocationTier; score: number } {
  const userLoc = (ctx.location || "").toLowerCase().trim();
  const jobLoc = (job.location || "").toLowerCase();

  if (!userLoc || userLoc === "remote" || userLoc === "anywhere") {
    if (job.remote) return { tier: "remote", score: 1 };
    return { tier: "other", score: 0.6 };
  }
  const parsed = parseUserLoc(userLoc);
  if (parsed.city && jobLoc.includes(parsed.city)) return { tier: "same_city", score: 1 };
  if (parsed.state && jobLoc.includes(parsed.state)) return { tier: "same_state", score: 0.85 };
  if (job.remote) return { tier: "remote", score: 0.75 };
  if (parsed.country && jobLoc.includes(parsed.country)) return { tier: "same_country", score: 0.55 };
  return { tier: "other", score: 0.2 };
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

export function rankJob(job: RawJob, ctx: CandidateContext): RankingResult {
  const hay = normTxt(`${job.title} ${job.description} ${job.tech_stack.join(" ")}`);

  // title
  const title = titleRelevance(job.title, ctx.role);

  // skills
  const wanted = ctx.skills.map((s) => s.trim()).filter(Boolean);
  const matched: string[] = [];
  const missing: string[] = [];
  for (const s of wanted) (skillHits(s, hay) ? matched : missing).push(s);
  const skills = wanted.length ? matched.length / wanted.length : 0.5;

  // experience
  const jobBucket = classifyExperience(job.title, job.description);
  const expFit = experienceFit(jobBucket, ctx.experienceBucket ?? null);
  const expMismatch = ctx.experienceBucket ? jobBucket !== ctx.experienceBucket : false;

  // location
  const loc = locationTier(job, ctx);

  // freshness
  const days = job.posted_at
    ? Math.max(0, Math.floor((Date.now() - new Date(job.posted_at).getTime()) / 86_400_000))
    : 7;
  const fresh = freshnessFromDays(days);

  // salary
  const sal = salaryScore(job, ctx.desiredSalaryMin ?? null);

  const base =
    0.30 * title.score +
    0.25 * skills +
    0.15 * expFit +
    0.12 * loc.score +
    0.10 * fresh +
    0.08 * sal.score;

  const penalty = (title.mismatch ? 0.4 : 1) * (expMismatch ? 0.5 : 1);
  const matchScore = Math.max(0, Math.min(1, base * penalty));

  return {
    matchScore,
    intelligence: labelFor(matchScore),
    breakdown: {
      title:      Number(title.score.toFixed(2)),
      skills:     Number(skills.toFixed(2)),
      experience: Number(expFit.toFixed(2)),
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
