/** Types mirroring the Imperium FastAPI response shapes (main.py + storage/database.py). */

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
  | "Applied"
  | "Under Review"
  | "Interview Scheduled"
  | "Rejected"
  | "Offer Received"
  | "Manual Review";

export interface ApplicationRecord {
  application_id: string;
  listing_id: string;
  company: string;
  job_title: string;
  date_applied?: string;
  status: ApplicationStatus | string;
  match_score?: number;
  resume_path?: string | null;
  cover_letter_path?: string | null;
  last_updated?: string;
  notes?: string | null;
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
