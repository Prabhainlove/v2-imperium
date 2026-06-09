/**
 * JobValidationService — gates raw jobs before they are ranked or surfaced.
 *
 * Every job is scored on 4 axes (description, url, company metadata, location)
 * plus source confidence and (optional) experience integrity. A single
 * `qualityStatus` summarises the outcome.
 *
 * Pure function — no I/O. Designed to run once per job during normalization.
 */
import type { RawJob } from "@backend/jobs/JobSources.server";

export type QualityStatus = "ok" | "incomplete" | "invalid_url" | "missing_description";
export type DescriptionSource = "jsonld" | "og" | "dom" | "api" | "placeholder" | "unknown";

export interface QualityReport {
  qualityStatus: QualityStatus;
  qualityScore: number;            // 0-100
  qualityReasons: string[];
  sourceConfidence: number;        // 0..1
  descriptionSource: DescriptionSource;
  experienceIntegrity: "consistent" | "mismatch" | "unknown";
}

/** Threshold raised per ops feedback — short JD blobs were polluting Top 5. */
export const DESCRIPTION_MIN_CHARS = 150;

/** India-native > LinkedIn > YC/Wellfound > remote boards. Feeds ranking too. */
export const SOURCE_CONFIDENCE: Record<string, number> = {
  naukri: 1.0,
  foundit: 1.0,
  instahyre: 1.0,
  hirist: 1.0,
  linkedin: 0.95,
  adzuna: 0.9,
  jooble: 0.85,
  wellfound: 0.85,
  yc: 0.85,
  remoteok: 0.7,
  remotive: 0.7,
  arbeitnow: 0.6,
};

const LINKEDIN_PLACEHOLDER_RE = /click through for full job description/i;

function inferDescriptionSource(raw: RawJob): DescriptionSource {
  const declared = (raw as RawJob & { description_source?: DescriptionSource }).description_source;
  if (declared) return declared;
  if (!raw.description) return "unknown";
  if (LINKEDIN_PLACEHOLDER_RE.test(raw.description)) return "placeholder";
  // Heuristic defaults by source
  if (raw.source === "yc") return "jsonld";
  if (raw.source === "linkedin") return "dom";
  if (raw.source === "naukri" && raw.external_id.startsWith("naukri-html-")) return "dom";
  if (raw.source === "wellfound" || raw.source === "hirist") return "dom";
  return "api";
}

function isValidUrl(u: string): boolean {
  if (!u) return false;
  try {
    const parsed = new URL(u);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Experience integrity: when the source ships an `experience_text` but our
 * classifier disagrees with the title (e.g. text says "fresher" yet the
 * title says "Senior"), surface that so downstream rules can demote.
 */
function checkExperienceIntegrity(
  raw: RawJob,
): "consistent" | "mismatch" | "unknown" {
  const t = raw.title.toLowerCase();
  const expText = (
    (raw as RawJob & { experience_text?: string | null }).experience_text ?? ""
  ).toLowerCase();
  if (!expText) return "unknown";

  const titleIsSenior = /\b(senior|sr\.?|lead|principal|staff|architect|head|director|vp|manager)\b/.test(t);
  const titleIsJunior = /\b(intern|graduate|fresher|trainee|entry[- ]level|junior|jr\.?)\b/.test(t);

  const textIsFresher = /\bfresher\b|\b0\s*[-to]+\s*1\b/.test(expText);
  const textIsSenior = /\b([5-9]|1\d)\s*\+?\s*(?:years|yrs)\b/.test(expText);

  if (titleIsSenior && textIsFresher) return "mismatch";
  if (titleIsJunior && textIsSenior) return "mismatch";
  return "consistent";
}

export function validateJob(raw: RawJob): QualityReport {
  const reasons: string[] = [];
  const descriptionSource = inferDescriptionSource(raw);
  const sourceConfidence = SOURCE_CONFIDENCE[raw.source] ?? 0.6;

  // Hard requirements
  const missing: string[] = [];
  if (!raw.title?.trim()) missing.push("title");
  if (!raw.company?.trim() || raw.company === "Unknown") missing.push("company");
  if (!raw.location?.trim()) missing.push("location");
  if (!raw.url?.trim()) missing.push("url");
  if (missing.length) reasons.push(`missing:${missing.join(",")}`);

  const urlOk = isValidUrl(raw.url);
  if (!urlOk) reasons.push("invalid_url");

  const descLen = (raw.description ?? "").trim().length;
  const isPlaceholder = descriptionSource === "placeholder";
  const descOk = !isPlaceholder && descLen >= DESCRIPTION_MIN_CHARS;
  if (!descOk) reasons.push(isPlaceholder ? "placeholder_description" : `short_description(${descLen})`);

  const experienceIntegrity = checkExperienceIntegrity(raw);
  if (experienceIntegrity === "mismatch") reasons.push("experience_title_mismatch");

  // Score: description 40, url 20, company 15, location 10, source confidence 15
  let score = 0;
  if (descOk) score += 40;
  else if (descLen >= 50) score += 20;
  if (urlOk) score += 20;
  if (!missing.includes("company")) score += 15;
  if (!missing.includes("location")) score += 10;
  score += Math.round(sourceConfidence * 15);
  if (experienceIntegrity === "mismatch") score = Math.max(0, score - 15);
  score = Math.max(0, Math.min(100, score));

  let qualityStatus: QualityStatus;
  if (missing.length) qualityStatus = "incomplete";
  else if (!urlOk) qualityStatus = "invalid_url";
  else if (!descOk) qualityStatus = "missing_description";
  else qualityStatus = "ok";

  return {
    qualityStatus,
    qualityScore: score,
    qualityReasons: reasons,
    sourceConfidence,
    descriptionSource,
    experienceIntegrity,
  };
}
