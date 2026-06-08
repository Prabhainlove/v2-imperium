/** Types mirroring Imperium server function responses. */

export interface HealthResponse {
  status: string;
  kernel_running?: boolean;
  agents_count?: number;
  version?: string;
}

export interface AgentInfo {
  name: string;
  capabilities?: string[];
  skills?: string[];
  status?: string;
}

export interface ProfileHealth {
  score: number;
  checks: Record<string, boolean>;
  missing: string[];
}

export interface CandidateProfile {
  profile_id?: string;
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  skills?: string[];
  linkedin_profile?: string;
  github_repositories?: string[];
  target_roles?: string[];
  preferred_locations?: string[];
  remote_only?: boolean;
  salary_min?: number;
  salary_max?: number;
  work_experience?: unknown[];
  education?: unknown[];
  projects?: unknown[];
  certifications?: unknown[];
  portfolio_links?: string[];
  preferences?: Record<string, unknown>;
}

export interface ProfileResponse {
  status: string;
  profile: CandidateProfile | null;
  profile_health: ProfileHealth;
}

export interface JobListing {
  listing_id: string;
  source: string;
  url?: string;
  title: string;
  company: string;
  location?: string;
  remote?: boolean;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  required_skills?: string[];
  experience_years?: number | null;
  technology_stack?: string[];
  discovered_at?: string;
  posted_at?: string | null;
  description?: string;
  match_score?: number;
  status?: string;
}

export type ApplicationStatus =
  | "Saved"
  | "Preparing"
  | "Applied"
  | "Assessment"
  | "Interview"
  | "Offer"
  | "Rejected"
  | "Withdrawn";

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "Saved",
  "Preparing",
  "Applied",
  "Assessment",
  "Interview",
  "Offer",
  "Rejected",
  "Withdrawn",
];

export interface ApplicationRecord {
  application_id: string;
  listing_id: string;
  company: string;
  job_title: string;
  source?: string;
  url?: string;
  date_applied?: string;
  status: ApplicationStatus | string;
  match_score?: number;
  resume_path?: string | null;
  cover_letter_path?: string | null;
  resume_version?: string;
  cover_letter_version?: string;
  last_updated?: string;
  notes?: string | null;
  interview_notes?: string;
  recruiter_notes?: string;
  next_action?: string;
  next_action_at?: string | null;
  matched_skills?: string[];
  missing_skills?: string[];
  salary_match?: number;
  experience_match?: number;
  location_match?: number;
  application_fields?: Record<string, string>;
}

export interface ApplicationTimelineEntry {
  id: string;
  application_id: string;
  event_type: string;
  from_status: string;
  to_status: string;
  note: string;
  created_at: string;
}

export interface InterviewRecord {
  id: string;
  application_id: string | null;
  company: string;
  position: string;
  stage: string;
  interview_at: string | null;
  location: string;
  recruiter: string;
  notes: string;
  feedback: string;
  outcome: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityLogEntry {
  log_id: number;
  task_id?: string | null;
  agent?: string | null;
  action: string;
  status?: string | null;
  detail?: string | null;
  created_at: string;
}

export interface NotificationEntry {
  notification_id: string;
  title: string;
  message: string;
  channel?: string;
  priority?: string;
  created_at: string;
  read_at?: string | null;
}

export interface DashboardSnapshot {
  metrics?: Record<string, number | string>;
  recent_applications?: ApplicationRecord[];
  strategy?: Record<string, unknown>;
  strategy_metrics?: Record<string, unknown>;
  notifications?: NotificationEntry[];
  activity?: ActivityLogEntry[];
  timestamp?: string;
}

export interface SearchMatch {
  application_id?: string;
  listing_id: string;
  title: string;
  company: string;
  location?: string;
  source: string;
  url?: string;
  match_score: number;
  is_recent?: boolean;
  matched_skills?: string[];
  missing_skills?: string[];
  salary_match?: number;
  experience_match?: number;
  location_match?: number;
  resume_path?: string | null;
  cover_letter_path?: string | null;
  submission_status?: string;
  submitted?: boolean;
}

export interface SearchSummary {
  jobs_found: number;
  qualified_matches: number;
  application_packages: number;
  real_submissions: number;
  skipped: number;
  duration_seconds: number;
}

export interface SearchResponse {
  status: string;
  task_id: string;
  mode?: string;
  message?: string;
  profile_health?: ProfileHealth;
  summary?: SearchSummary;
  matches?: SearchMatch[];
  skipped?: SearchMatch[];
  per_source?: Record<string, { count: number; status: "ok" | "failed" | "skipped" }>;
  reflection?: string;
}

export interface SearchInput {
  role: string;
  location: string;
  resume?: File | null;
  template?: string;
  name?: string;
  email?: string;
  phone?: string;
  skills?: string;
  experience?: string;
  company?: string;
  application_mode?: string;
  max_applications?: number;
}

export interface AtsAnalysis {
  score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  added_keywords: string[];
  improvements: string[];
  word_count: number;
}

export interface RenderedResume {
  application_id: string;
  template: "jake-ats" | "classic" | "modern" | "compact";
  original_md: string;
  optimized_md: string;
  rendered_html: string;
  ats: AtsAnalysis;
}
