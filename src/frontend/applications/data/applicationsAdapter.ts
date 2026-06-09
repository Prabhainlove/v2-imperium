/**
 * applicationsAdapter — translates backend application DTOs into the
 * Application / ApplicationEvent shapes the Application Tracker UI uses.
 *
 * Backend table (`applications`) and timeline (`application_timeline`) hold
 * the source of truth. Status values may be either canonical lowercase
 * (Application Tracker V2 — applied/viewed/under_review/…) or legacy
 * capitalized pipeline values (Saved/Preparing/Applied/Interview/…).
 * Snapshot fields without dedicated columns (ATS score, template, salary,
 * description, agent run id, free-form user note) live inside the
 * `notes` JSON blob.
 */
import {
  type Application,
  type ApplicationEvent,
  type ApplicationStatus,
  type ApplicationSourcePortal,
  type ApplicationOrigin,
  hashString,
} from "../schema";
import { withIntelligence } from "../intelligence/ApplicationIntelligenceEngine";

const VALID_STATUS: ReadonlySet<ApplicationStatus> = new Set([
  "applied",
  "viewed",
  "under_review",
  "assessment",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
]);

const VALID_SOURCES: ReadonlySet<ApplicationSourcePortal> = new Set([
  "linkedin",
  "naukri",
  "foundit",
  "instahyre",
  "hirist",
  "wellfound",
  "other",
]);

export function normalizeStatus(raw: string | null | undefined): ApplicationStatus {
  if (!raw) return "applied";
  const k = raw.toLowerCase().replace(/[\s-]+/g, "_");
  if (VALID_STATUS.has(k as ApplicationStatus)) return k as ApplicationStatus;
  if (k === "preparing" || k === "saved" || k === "manualapplypending" || k === "manual_apply_pending") return "applied";
  return "applied";
}

function normalizeSource(raw: string | null | undefined): ApplicationSourcePortal {
  if (!raw) return "other";
  const k = raw.toLowerCase();
  return (VALID_SOURCES.has(k as ApplicationSourcePortal) ? k : "other") as ApplicationSourcePortal;
}

export interface BackendAppDto {
  application_id: string;
  listing_id: string;
  company: string;
  job_title: string;
  source: string;
  url: string;
  date_applied: string;
  status: string;
  match_score: number;
  resume_path: string | null;
  cover_letter_path: string | null;
  resume_version: string;
  cover_letter_version: string;
  last_updated: string;
  notes: string | null;
  interview_notes: string;
  recruiter_notes: string;
  next_action: string;
  next_action_at: string | null;
  matched_skills: string[];
  missing_skills: string[];
  salary_match?: number;
  experience_match?: number;
  location_match?: number;
  application_fields?: Record<string, string>;
}

interface ParsedMeta {
  ats_score?: number;
  template_used?: string;
  applied_origin?: ApplicationOrigin;
  agent_run_id?: string;
  resume_id?: string;
  salary?: string;
  location?: string;
  description?: string;
  user_note?: string;
}

function parseMeta(raw: string | null | undefined): ParsedMeta {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    if (v && typeof v === "object" && !Array.isArray(v)) return v as ParsedMeta;
  } catch { /* legacy plain text */ }
  return {};
}

export function backendToApplication(dto: BackendAppDto): Application {
  // dto.notes is the raw notes column — it may be JSON metadata OR plain legacy text.
  const meta = parseMeta(dto.notes);
  const userNote =
    meta.user_note ??
    (dto.notes && typeof dto.notes === "string" && !dto.notes.startsWith("{") ? dto.notes : undefined);

  const appliedAt = dto.date_applied || dto.last_updated || new Date().toISOString();
  const base: Application = {
    id: dto.application_id,
    company: dto.company,
    role: dto.job_title,
    location: meta.location ?? "",
    source: normalizeSource(dto.source),
    applicationSource: meta.applied_origin ?? "resume_studio",
    appliedAt,
    status: normalizeStatus(dto.status),
    atsScore: typeof meta.ats_score === "number" ? meta.ats_score : undefined,
    matchScore: dto.match_score || undefined,
    resumeId: meta.resume_id ?? dto.resume_version ?? "",
    resumeVersion: dto.resume_version || "V1",
    templateUsed: meta.template_used ?? "professional",
    sourceUrl: dto.url || undefined,
    notes: userNote,
    agentRunId: meta.agent_run_id,
    jobSnapshot: {
      title: dto.job_title,
      company: dto.company,
      location: meta.location ?? "",
      salary: meta.salary,
      source: dto.source ?? "other",
      descriptionHash: hashString(meta.description ?? ""),
    },
    intelligence: { ageDays: 0, stale: false, responseProbability: 0.5, nextRecommendedAction: "" },
    createdAt: appliedAt,
    updatedAt: dto.last_updated || appliedAt,
  };
  return withIntelligence(base);
}

export interface BackendTimelineDto {
  id: string;
  application_id: string;
  event_type: string;
  from_status: string;
  to_status: string;
  note: string;
  created_at: string;
}

export function backendToEvent(dto: BackendTimelineDto): ApplicationEvent {
  const type: ApplicationEvent["type"] =
    dto.event_type === "application_submitted"
      ? "application_submitted"
      : dto.event_type === "status_change"
        ? (dto.to_status?.toLowerCase() === "interview"
            ? "interview_scheduled"
            : dto.to_status?.toLowerCase() === "offer"
              ? "offer_received"
              : dto.to_status?.toLowerCase() === "rejected"
                ? "rejected"
                : dto.to_status?.toLowerCase() === "withdrawn"
                  ? "withdrawn"
                  : "status_changed")
        : "status_changed";
  return {
    id: dto.id,
    applicationId: dto.application_id,
    type,
    title: dto.note || (dto.to_status ? `Status → ${dto.to_status}` : dto.event_type),
    description: dto.note || undefined,
    timestamp: dto.created_at,
  };
}
