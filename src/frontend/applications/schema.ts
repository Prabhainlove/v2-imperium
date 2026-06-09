/**
 * Application Tracker V2 — schema.
 * All applications originate from Imperium workflows (Resume Studio or Local Agent).
 * No manual creation path is exposed.
 */

export type ApplicationStatus =
  | "applied"
  | "viewed"
  | "under_review"
  | "assessment"
  | "interview"
  | "offer"
  | "rejected"
  | "withdrawn";

export type ApplicationSourcePortal =
  | "linkedin"
  | "naukri"
  | "foundit"
  | "instahyre"
  | "hirist"
  | "wellfound"
  | "other";

export type ApplicationOrigin = "resume_studio" | "local_agent";

export interface JobSnapshot {
  title: string;
  company: string;
  location: string;
  salary?: string;
  source: string;
  descriptionHash: string;
}

export interface ApplicationIntelligence {
  ageDays: number;
  stale: boolean;
  responseProbability: number; // 0..1
  nextRecommendedAction: string;
}

export interface AgentMetadata {
  portal: string;
  executionTime: number;
  resumeVersion: string;
}

export interface Application {
  id: string;
  company: string;
  role: string;
  location: string;
  source: ApplicationSourcePortal;
  applicationSource: ApplicationOrigin;
  appliedAt: string; // ISO
  status: ApplicationStatus;
  atsScore?: number;
  matchScore?: number;
  resumeId: string;
  resumeVersion: string;
  templateUsed: string;
  sourceUrl?: string;
  notes?: string;
  agentRunId?: string;
  agentMetadata?: AgentMetadata;
  jobSnapshot: JobSnapshot;
  // Intelligence is recomputed at read time; persisted as snapshot only.
  intelligence: ApplicationIntelligence;
  createdAt: string;
  updatedAt: string;
}

export type ApplicationEventType =
  | "application_submitted"
  | "status_changed"
  | "note_added"
  | "interview_scheduled"
  | "offer_received"
  | "rejected"
  | "withdrawn";

export interface ApplicationEvent {
  id: string;
  applicationId: string;
  type: ApplicationEventType;
  title: string;
  description?: string;
  timestamp: string; // ISO
}

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  applied: "Applied",
  viewed: "Viewed",
  under_review: "Under Review",
  assessment: "Assessment",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const PIPELINE_COLUMNS: ApplicationStatus[] = [
  "applied",
  "viewed",
  "under_review",
  "assessment",
  "interview",
  "offer",
  "rejected",
];

export const SOURCE_LABEL: Record<ApplicationSourcePortal, string> = {
  linkedin: "LinkedIn",
  naukri: "Naukri",
  foundit: "Foundit",
  instahyre: "Instahyre",
  hirist: "Hirist",
  wellfound: "Wellfound",
  other: "Other",
};

export function newApplicationId(): string {
  return `app_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function newEventId(): string {
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function hashString(s: string): string {
  // djb2
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(16);
}
