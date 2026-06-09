/**
 * JobNormalizationService — converts a RawJob from any source into a single
 * NormalizedJob DTO the UI can render. Adds company branding (logo) and
 * ranking output. No persistence here.
 */
import type { RawJob } from "@backend/jobs/JobSources.server";
import { rankJob, type CandidateContext, type IntelligenceLabel, type MatchBreakdown, type ExperienceBucket, type LocationTier } from "@backend/jobs/JobRankingService.server";
import { getCompanyInfo } from "@backend/jobs/CompanyInfoService.server";

export interface NormalizedJob {
  id: string;
  externalId: string;
  source: string;
  title: string;
  company: string;
  companyLogo: string;
  companyDomain: string;
  companyWebsite: string;
  location: string;
  remote: boolean;
  workMode: string;
  salary: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  description: string;
  skills: string[];
  url: string;
  postedAt: string | null;
  retrievedAt: string;
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

function formatSalary(min: number | null, max: number | null, currency: string): string {
  const cur = currency || "USD";
  const symbol = cur === "INR" ? "₹" : cur === "EUR" ? "€" : cur === "GBP" ? "£" : "$";
  const k = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`);
  if (min && max) return `${symbol}${k(min)} – ${symbol}${k(max)}`;
  if (min) return `${symbol}${k(min)}+`;
  if (max) return `up to ${symbol}${k(max)}`;
  return "Not disclosed";
}

export function normalizeJob(raw: RawJob, ctx: CandidateContext): NormalizedJob {
  const company = getCompanyInfo(raw.company);
  const ranking = rankJob(raw, ctx);
  return {
    id: `${raw.source}:${raw.external_id}`,
    externalId: raw.external_id,
    source: raw.source,
    title: raw.title,
    company: company.name,
    companyLogo: company.logoUrl,
    companyDomain: company.domain,
    companyWebsite: company.website,
    location: raw.location || (raw.remote ? "Remote" : ""),
    remote: raw.remote,
    workMode: raw.remote ? "Remote" : "On-site",
    salary: formatSalary(raw.salary_min, raw.salary_max, raw.salary_currency),
    salaryMin: raw.salary_min,
    salaryMax: raw.salary_max,
    salaryCurrency: raw.salary_currency,
    description: raw.description,
    skills: raw.tech_stack,
    url: raw.url,
    postedAt: raw.posted_at,
    retrievedAt: new Date().toISOString(),
    ...ranking,
  };
}

export function normalizeMany(raws: RawJob[], ctx: CandidateContext): NormalizedJob[] {
  return raws.map((r) => normalizeJob(r, ctx)).sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    if (a.freshnessDays !== b.freshnessDays) return a.freshnessDays - b.freshnessDays;
    if (b.matchedSkills.length !== a.matchedSkills.length) return b.matchedSkills.length - a.matchedSkills.length;
    return (b.salaryMin ?? 0) - (a.salaryMin ?? 0);
  });
}

/** Filter that selects best Top-5 candidates: no title mismatches, min score gate. */
export function selectTop5(jobs: NormalizedJob[]): NormalizedJob[] {
  return jobs.filter((j) => !j.titleMismatch && j.matchScore >= 0.45).slice(0, 5);
}

