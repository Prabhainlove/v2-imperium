/**
 * JobNormalizationService — converts a RawJob from any source into a single
 * NormalizedJob DTO the UI can render. Adds company branding (logo), ranking
 * and quality validation. No persistence here.
 *
 * Top-5 rules (Data Quality Recovery):
 *   - qualityStatus === "ok" && qualityScore >= 60
 *   - !titleMismatch
 *   - matchScore ≥ 0.5
 *   - freshnessDays ≤ 30
 *   - locationTier ∈ {same_city, same_state, remote, same_country}
 *   - never pad
 */
import type { RawJob } from "@backend/jobs/JobSources.server";
import { rankJob, type CandidateContext, type IntelligenceLabel, type MatchBreakdown, type ExperienceBucket, type LocationTier } from "@backend/jobs/JobRankingService.server";
import { getCompanyInfo } from "@backend/jobs/CompanyInfoService.server";
import { validateJob, type QualityStatus, type DescriptionSource } from "@backend/jobs/JobValidationService.server";

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
  experienceBucket: ExperienceBucket | null;
  locationTier: LocationTier;
  freshnessDays: number;
  isNewToday: boolean;
  titleMismatch: boolean;
  belowSalary: boolean;
  // Quality
  qualityStatus: QualityStatus;
  qualityScore: number;
  qualityReasons: string[];
  descriptionSource: DescriptionSource;
  sourceConfidence: number;
  experienceIntegrity: "consistent" | "mismatch" | "unknown";
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
  const quality = validateJob(raw);
  const ranking = rankJob(raw, ctx, { sourceConfidence: quality.sourceConfidence });
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
    qualityStatus: quality.qualityStatus,
    qualityScore: quality.qualityScore,
    qualityReasons: quality.qualityReasons,
    descriptionSource: quality.descriptionSource,
    sourceConfidence: quality.sourceConfidence,
    experienceIntegrity: quality.experienceIntegrity,
  };
}

export function normalizeMany(raws: RawJob[], ctx: CandidateContext): NormalizedJob[] {
  return raws.map((r) => normalizeJob(r, ctx)).sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    if (a.freshnessDays !== b.freshnessDays) return a.freshnessDays - b.freshnessDays;
    if (b.qualityScore !== a.qualityScore) return b.qualityScore - a.qualityScore;
    if (b.matchedSkills.length !== a.matchedSkills.length) return b.matchedSkills.length - a.matchedSkills.length;
    return (b.salaryMin ?? 0) - (a.salaryMin ?? 0);
  });
}

/** Top-5 selector (strict): see file header for rules. */
export function selectTop5(jobs: NormalizedJob[]): NormalizedJob[] {
  const allowedTiers: LocationTier[] = ["same_city", "same_state", "remote", "same_country"];
  return jobs
    .filter((j) =>
      j.qualityStatus === "ok" &&
      j.qualityScore >= 60 &&
      !j.titleMismatch &&
      j.matchScore >= 0.5 &&
      j.freshnessDays <= 30 &&
      allowedTiers.includes(j.locationTier),
    )
    .slice(0, 5);
}
