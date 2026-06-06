/** Imperium client — thin wrappers around TanStack server functions. */
import * as fns from "./server.functions";
import type {
  ActivityLogEntry,
  AgentInfo,
  ApplicationRecord,
  DashboardSnapshot,
  HealthResponse,
  JobListing,
  NotificationEntry,
  RenderedResume,
  SearchInput,
  SearchResponse,
} from "./types";
import type { ImperiumProfile, GithubIntel } from "./profile/types";

async function readFileAsText(file: File): Promise<string> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf") || lower.endsWith(".docx") || lower.endsWith(".doc")) {
    return `[Resume file uploaded: ${file.name} — ${(file.size / 1024).toFixed(1)} KB]`;
  }
  try { return await file.text(); } catch { return ""; }
}

export const getHealth = (_signal?: AbortSignal) =>
  fns.getHealth() as unknown as Promise<HealthResponse>;
export const getAgents = (_signal?: AbortSignal) =>
  fns.getAgents() as unknown as Promise<AgentInfo[]>;

export const getProfile = () =>
  fns.getProfile() as unknown as Promise<{ status: string; profile: ImperiumProfile | null }>;
export const getAgentContext = () =>
  fns.getAgentContext() as unknown as Promise<{
    profile: ImperiumProfile | null;
    completeness: import("./profile/completeness").ProfileCompleteness;
    agent_context: {
      personal: ImperiumProfile extends infer _T ? Record<string, unknown> : never;
      career: Record<string, unknown>;
      skills: string[];
      projects: unknown[];
      experience: unknown[];
      education: unknown[];
      certifications: unknown[];
      languages: unknown[];
      achievements: string[];
      is_fresher: boolean;
      vocabulary_size: number;
    };
  }>;
export const saveProfile = (payload: Partial<ImperiumProfile>) =>
  fns.saveProfile({ data: payload as Record<string, unknown> }) as unknown as Promise<{
    status: string; profile: ImperiumProfile | null;
  }>;
export const refreshGithubIntel = (url?: string) =>
  fns.refreshGithubIntel({ data: { url } }) as unknown as Promise<GithubIntel>;

export type ImportedProfileResult = {
  patch: Partial<ImperiumProfile>;
  model: string;
  source_chars?: number;
};
export const importProfileFromText = (text: string) =>
  fns.importProfileFromText({ data: { text } }) as unknown as Promise<ImportedProfileResult>;
export const importProfileFromLinkedin = (url: string) =>
  fns.importProfileFromLinkedin({ data: { url } }) as unknown as Promise<ImportedProfileResult>;
export const importProfileFromPdf = (base64: string) =>
  fns.importProfileFromPdf({ data: { base64 } }) as unknown as Promise<ImportedProfileResult>;


export const getDashboard = (_signal?: AbortSignal) =>
  fns.getDashboard() as unknown as Promise<DashboardSnapshot>;
export const getJobs = (params: { limit?: number } = {}, _signal?: AbortSignal) =>
  fns.getJobs({ data: { limit: params.limit } }) as unknown as Promise<JobListing[]>;
export const getApplications = (
  params: { status?: string; limit?: number } = {},
  _signal?: AbortSignal,
) =>
  fns.getApplications({ data: { status: params.status, limit: params.limit } }) as unknown as Promise<ApplicationRecord[]>;
export const getApplication = (id: string) =>
  fns.getApplication({ data: { id } }) as unknown as Promise<
    ApplicationRecord & { resume_md: string; cover_letter_md: string }
  >;
export const approveApplication = (id: string) =>
  fns.approveApplication({ data: { id } }) as unknown as Promise<{ ok: boolean }>;
export const skipApplication = (id: string) =>
  fns.skipApplicationFn({ data: { id } }) as unknown as Promise<{ ok: boolean }>;
export const getActivity = (
  params: { limit?: number; task_id?: string } = {},
  _signal?: AbortSignal,
) =>
  fns.getActivity({ data: { limit: params.limit, task_id: params.task_id } }) as unknown as Promise<ActivityLogEntry[]>;
export const getNotifications = (_params: { limit?: number } = {}) =>
  fns.getNotifications() as unknown as Promise<NotificationEntry[]>;
export const markNotificationRead = async (_id: string) => ({ status: "ok" });
export const renderApplicationResume = (
  application_id: string,
  template: "classic" | "modern" | "compact" = "classic",
) =>
  fns.renderApplicationResume({ data: { application_id, template } }) as unknown as Promise<RenderedResume>;

export const getProfileIntelligence = () =>
  fns.getProfileIntelligence() as unknown as Promise<
    import("./brain/types").ProfileIntelligence | null
  >;
export const getCareerIntelligence = () =>
  fns.getCareerIntelligence() as unknown as Promise<import("./brain/types").CareerInsight>;

export const optimizeMasterResume = (payload: {
  resume_md: string;
  job_description: string;
  job_title?: string;
  company?: string;
  template?: "classic" | "modern" | "compact";
}) =>
  fns.optimizeMasterResume({ data: payload }) as unknown as Promise<
    import("./brain/types").ResumeOptimization
  >;

export const analyzeJobListing = (id: string) =>
  fns.analyzeJobListing({ data: { id } }) as unknown as Promise<
    import("./brain/types").JobScore
  >;

export const evaluateApplication = (id: string) =>
  fns.evaluateApplication({ data: { id } }) as unknown as Promise<{
    job_score: import("./brain/types").JobScore;
    ats: import("./types").AtsAnalysis;
    readiness: import("./brain/types").ApplicationReadiness;
  }>;

export function artifactUrl(path: string): string {
  return `#artifact/${encodeURIComponent(path)}`;
}
export async function fetchArtifactText(path: string): Promise<string> {
  const r = (await fns.getArtifact({ data: { path } })) as { content: string };
  return r.content;
}

export async function runJobSearch(
  input: SearchInput,
  _signal?: AbortSignal,
): Promise<SearchResponse> {
  const resume_text = input.resume ? await readFileAsText(input.resume) : "";
  return (await fns.runJobSearch({
    data: {
      role: input.role,
      location: input.location,
      experience: input.experience ?? "",
      skills: input.skills ?? "",
      name: input.name ?? "Candidate",
      email: input.email ?? "candidate@example.com",
      phone: input.phone ?? "",
      company: input.company ?? "",
      max_applications: input.max_applications ?? 8,
      resume_text,
    },
  })) as unknown as SearchResponse;
}

/* ---------- Phase A: status pipeline, timeline, saved jobs, interviews ---------- */
import type {
  ApplicationStatus,
  ApplicationTimelineEntry,
  InterviewRecord,
} from "./types";

export const updateApplicationStatus = (id: string, status: ApplicationStatus, note?: string) =>
  fns.updateApplicationStatus({ data: { id, status, note } }) as unknown as Promise<{ ok: boolean }>;

export const updateApplicationFields = (
  id: string,
  patch: {
    interview_notes?: string;
    recruiter_notes?: string;
    next_action?: string;
    next_action_at?: string | null;
    resume_version?: string;
    cover_letter_version?: string;
  },
) =>
  fns.updateApplicationFields({ data: { id, ...patch } }) as unknown as Promise<{ ok: boolean }>;

export const getApplicationTimeline = (id: string) =>
  fns.getApplicationTimeline({ data: { id } }) as unknown as Promise<ApplicationTimelineEntry[]>;

export const saveJobListing = (payload: {
  source: string;
  external_id: string;
  url?: string;
  title: string;
  company: string;
  location?: string;
  remote?: boolean;
  description?: string;
  tech_stack?: string[];
  match_score?: number;
  bookmarked?: boolean;
}) =>
  fns.saveJobListing({ data: payload as Record<string, unknown> }) as unknown as Promise<{
    ok: boolean;
    id: string;
  }>;

export const unsaveJobListing = (id: string) =>
  fns.unsaveJobListing({ data: { id } }) as unknown as Promise<{ ok: boolean }>;

export const getSavedJobs = () => fns.getSavedJobs() as unknown as Promise<JobListing[]>;

export type InterviewInput = {
  id?: string;
  application_id?: string | null;
  company: string;
  position?: string;
  stage?:
    | "Screening"
    | "Technical"
    | "Managerial"
    | "Final Round"
    | "Offer"
    | "Rejected";
  interview_at?: string | null;
  location?: string;
  recruiter?: string;
  notes?: string;
  feedback?: string;
  outcome?: string;
};

export const upsertInterview = (payload: InterviewInput) =>
  fns.upsertInterview({ data: payload as Record<string, unknown> }) as unknown as Promise<{
    ok: boolean;
    id: string;
  }>;

export const getInterviews = () =>
  fns.getInterviews() as unknown as Promise<InterviewRecord[]>;

export const deleteInterview = (id: string) =>
  fns.deleteInterview({ data: { id } }) as unknown as Promise<{ ok: boolean }>;

/* ---------- Skill Gap ---------- */
export type SkillGapItem = {
  skill: string;
  importance: "critical" | "important" | "nice_to_have";
  rationale: string;
  resource_hint: string;
};
export type SkillGapResult = {
  target_role: string;
  matched_skills: string[];
  missing_skills: SkillGapItem[];
  roadmap_30_60_90: { thirty: string[]; sixty: string[]; ninety: string[] };
  summary: string;
  model: string;
};
export const getSkillGap = () =>
  fns.getSkillGap() as unknown as Promise<SkillGapResult>;
