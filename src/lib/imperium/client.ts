/**
 * Imperium API client. Every backend call goes through here.
 * Base URL is resolved at call-time via getApiBaseUrl(), so changing
 * it in Settings takes effect immediately without a reload.
 */
import { apiUrl } from "./config";
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

class ImperiumError extends Error {
  status?: number;
  body?: unknown;
  constructor(message: string, status?: number, body?: unknown) {
    super(message);
    this.name = "ImperiumError";
    this.status = status;
    this.body = body;
  }
}

async function request<T>(
  path: string,
  init?: RequestInit & { signal?: AbortSignal },
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch (err) {
    throw new ImperiumError(
      err instanceof Error
        ? `Cannot reach Imperium backend: ${err.message}`
        : "Cannot reach Imperium backend",
    );
  }

  const text = await res.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const detail =
      (parsed as { detail?: string } | undefined)?.detail ??
      (typeof parsed === "string" ? parsed : res.statusText);
    throw new ImperiumError(
      `Backend error ${res.status}: ${detail}`,
      res.status,
      parsed,
    );
  }
  return parsed as T;
}

/* ---- System ---- */
export const getHealth = (signal?: AbortSignal) =>
  request<HealthResponse>("/health", { signal });

export const getAgents = (signal?: AbortSignal) =>
  request<AgentInfo[]>("/agents", { signal });

/* ---- Profile ---- */
export const getProfile = (signal?: AbortSignal) =>
  request<ProfileResponse>("/api/job-agent/profile", { signal });

export const saveProfile = (payload: Partial<CandidateProfile>) =>
  request<ProfileResponse>("/api/job-agent/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

/* ---- Dashboard / data ---- */
export const getDashboard = (signal?: AbortSignal) =>
  request<DashboardSnapshot>("/api/job-agent/dashboard", { signal });

export const getJobs = (params: { limit?: number } = {}, signal?: AbortSignal) => {
  const q = new URLSearchParams();
  if (params.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return request<JobListing[]>(
    `/api/job-agent/jobs${qs ? `?${qs}` : ""}`,
    { signal },
  );
};

export const getApplications = (
  params: { status?: string; limit?: number } = {},
  signal?: AbortSignal,
) => {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return request<ApplicationRecord[]>(
    `/api/job-agent/applications${qs ? `?${qs}` : ""}`,
    { signal },
  );
};

export const getActivity = (
  params: { limit?: number; task_id?: string } = {},
  signal?: AbortSignal,
) => {
  const q = new URLSearchParams();
  if (params.limit) q.set("limit", String(params.limit));
  if (params.task_id) q.set("task_id", params.task_id);
  const qs = q.toString();
  return request<ActivityLogEntry[]>(
    `/api/job-agent/activity${qs ? `?${qs}` : ""}`,
    { signal },
  );
};

export const getNotifications = (params: { limit?: number } = {}, signal?: AbortSignal) => {
  const q = new URLSearchParams();
  if (params.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return request<NotificationEntry[]>(
    `/api/job-agent/notifications${qs ? `?${qs}` : ""}`,
    { signal },
  );
};

export const markNotificationRead = (notificationId: string) =>
  request<{ status: string }>(
    `/api/job-agent/notifications/${encodeURIComponent(notificationId)}/read`,
    { method: "POST" },
  );

/* ---- Artifact download ---- */
export function artifactUrl(path: string): string {
  return apiUrl(`/api/job-agent/artifact?path=${encodeURIComponent(path)}`);
}

export async function fetchArtifactText(path: string): Promise<string> {
  const res = await fetch(artifactUrl(path));
  if (!res.ok) throw new ImperiumError(`Failed to load artifact (${res.status})`);
  return res.text();
}

/* ---- The search endpoint (multipart) ---- */
export async function runJobSearch(
  input: SearchInput,
  signal?: AbortSignal,
): Promise<SearchResponse> {
  const fd = new FormData();
  fd.set("role", input.role);
  fd.set("location", input.location);
  fd.set("template", input.template ?? "modern");
  fd.set("name", input.name ?? "Candidate");
  fd.set("email", input.email ?? "candidate@example.com");
  fd.set("phone", input.phone ?? "");
  fd.set("skills", input.skills ?? "");
  fd.set("experience", input.experience ?? "");
  fd.set("company", input.company ?? "");
  fd.set("application_mode", input.application_mode ?? "manual");
  fd.set("max_applications", String(input.max_applications ?? 8));
  if (input.resume) fd.set("resume", input.resume);

  let res: Response;
  try {
    res = await fetch(apiUrl("/api/job-agent/search"), {
      method: "POST",
      body: fd,
      signal,
    });
  } catch (err) {
    throw new ImperiumError(
      err instanceof Error
        ? `Search failed to reach backend: ${err.message}`
        : "Search failed to reach backend",
    );
  }

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { status: "error", message: text };
  }
  if (!res.ok) {
    throw new ImperiumError(
      `Search failed (${res.status})`,
      res.status,
      parsed,
    );
  }
  return parsed as SearchResponse;
}

export { ImperiumError };
