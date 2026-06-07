/**
 * core/automation/selenium_bridge.ts
 * ==================================
 * Purpose      : Browser-side HTTP bridge to the local Python Selenium
 *                agent running at http://127.0.0.1:8000
 *                (see `IMPERIUM/local_agent`).
 * Inputs       : Job url + candidate profile / job id for approve/reject.
 * Outputs      : Run ids + event streams from the local agent.
 * Responsibility: Transport only. No Selenium code here — the actual
 *                browser automation lives in Python.
 */

export interface LocalAgentRun {
  id: string;
  job_url: string;
  status: string;
  progress: number;
  current_step: string;
  current_action: string;
  current_url: string;
  approved: boolean | null;
  error: string;
  created_at: string;
  updated_at: string;
}

export interface LocalAgentEvent {
  ts: string;
  step: string;
  action: string;
  level: "info" | "success" | "warn" | "error";
  url?: string;
}

const DEFAULT_BASE = "http://127.0.0.1:8000";

function viteEnv(): Record<string, string> {
  return (typeof import.meta !== "undefined" && (import.meta as { env?: Record<string, string> }).env) || {};
}

function baseUrl(): string {
  return viteEnv().VITE_LOCAL_AGENT_URL || DEFAULT_BASE;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
  });
  if (!res.ok) throw new Error(`Local agent ${path} → ${res.status}`);
  return (await res.json()) as T;
}


export const localAgentHealth = () =>
  call<{ ok: boolean; chrome: boolean; headless: boolean; runs: number; version: string }>("/health");

export const localAgentApply = (job_url: string, profile: Record<string, unknown> = {}) =>
  call<{ job_id: string }>("/apply", {
    method: "POST",
    body: JSON.stringify({ job_url, profile }),
  });

export const localAgentApprove = (job_id: string) =>
  call<{ ok: boolean }>("/approve", { method: "POST", body: JSON.stringify({ job_id }) });

export const localAgentReject = (job_id: string) =>
  call<{ ok: boolean }>("/reject", { method: "POST", body: JSON.stringify({ job_id }) });

export const localAgentStatus = (job_id: string) => call<LocalAgentRun>(`/status/${job_id}`);

export const localAgentEvents = (job_id: string) =>
  call<{ events: LocalAgentEvent[]; status: string; progress: number }>(`/events/${job_id}`);

export const localAgentRuns = () => call<LocalAgentRun[]>("/runs");
