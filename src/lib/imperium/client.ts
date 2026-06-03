/**
 * Imperium client — thin wrappers around TanStack server functions.
 * The signal arg is preserved for callsite compatibility but ignored
 * (serverFn RPC handles its own request lifecycle).
 */
import * as fns from "./server.functions";
import type {
  ActivityLogEntry,
  AgentInfo,
  ApplicationRecord,
  CandidateProfile,
  DashboardSnapshot,
  HealthResponse,
  JobListing,
  NotificationEntry,
  ProfileResponse,
  SearchInput,
  SearchResponse,
} from "./types";

async function readFileAsText(file: File): Promise<string> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf") || lower.endsWith(".docx") || lower.endsWith(".doc")) {
    // Binary formats — we don't ship a parser in the browser; just use the name.
    return `[Resume file uploaded: ${file.name} — ${(file.size / 1024).toFixed(1)} KB]`;
  }
  try {
    return await file.text();
  } catch {
    return "";
  }
}

export const getHealth = (_signal?: AbortSignal) =>
  fns.getHealth() as unknown as Promise<HealthResponse>;

export const getAgents = (_signal?: AbortSignal) =>
  fns.getAgents() as unknown as Promise<AgentInfo[]>;

export const getProfile = (_signal?: AbortSignal) =>
  fns.getProfile() as unknown as Promise<ProfileResponse>;

export const saveProfile = (payload: Partial<CandidateProfile>) =>
  fns.saveProfile({ data: payload as Record<string, unknown> }) as unknown as Promise<ProfileResponse>;

export const getDashboard = (_signal?: AbortSignal) =>
  fns.getDashboard() as unknown as Promise<DashboardSnapshot>;

export const getJobs = (
  params: { limit?: number } = {},
  _signal?: AbortSignal,
) =>
  fns.getJobs({ data: { limit: params.limit } }) as unknown as Promise<JobListing[]>;

export const getApplications = (
  params: { status?: string; limit?: number } = {},
  _signal?: AbortSignal,
) =>
  fns.getApplications({
    data: { status: params.status, limit: params.limit },
  }) as unknown as Promise<ApplicationRecord[]>;

export const getActivity = (
  params: { limit?: number; task_id?: string } = {},
  _signal?: AbortSignal,
) =>
  fns.getActivity({
    data: { limit: params.limit, task_id: params.task_id },
  }) as unknown as Promise<ActivityLogEntry[]>;

export const getNotifications = (_params: { limit?: number } = {}) =>
  fns.getNotifications() as unknown as Promise<NotificationEntry[]>;

export const markNotificationRead = async (_id: string) => ({ status: "ok" });

/* ---- Artifacts ---- */

export function artifactUrl(path: string): string {
  return `#artifact/${encodeURIComponent(path)}`;
}

export async function fetchArtifactText(path: string): Promise<string> {
  const r = (await fns.getArtifact({ data: { path } })) as { content: string };
  return r.content;
}

/* ---- The search endpoint ---- */

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
