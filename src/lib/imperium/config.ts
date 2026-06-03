/**
 * Imperium frontend config + source registry (UI-side).
 */

const STORAGE_KEY = "imperium-api-base-url";
const DEFAULT_BASE_URL =
  (import.meta.env.VITE_IMPERIUM_API_BASE_URL as string | undefined) ??
  "http://localhost:8000";

export function getApiBaseUrl(): string {
  if (typeof window === "undefined") return DEFAULT_BASE_URL;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && stored.trim().length > 0) return stored.replace(/\/+$/, "");
  } catch {
    /* ignore */
  }
  return DEFAULT_BASE_URL.replace(/\/+$/, "");
}

export function setApiBaseUrl(url: string): void {
  if (typeof window === "undefined") return;
  const clean = url.trim().replace(/\/+$/, "");
  if (clean.length === 0) window.localStorage.removeItem(STORAGE_KEY);
  else window.localStorage.setItem(STORAGE_KEY, clean);
}

export function getDefaultBaseUrl(): string {
  return DEFAULT_BASE_URL.replace(/\/+$/, "");
}

export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/**
 * Production job sources the Imperium agent actually attempts.
 * `requiresKey` sources are gracefully skipped without a secret.
 */
export const REAL_SOURCES = [
  { id: "remoteok",  label: "RemoteOK",            requiresKey: false },
  { id: "remotive",  label: "Remotive",            requiresKey: false },
  { id: "arbeitnow", label: "Arbeitnow",           requiresKey: false },
  { id: "linkedin",  label: "LinkedIn",            requiresKey: false },
  { id: "indeed",    label: "Indeed (via Adzuna)", requiresKey: true  },
  { id: "naukri",    label: "Naukri",              requiresKey: false },
] as const;

export type SourceId = (typeof REAL_SOURCES)[number]["id"];
