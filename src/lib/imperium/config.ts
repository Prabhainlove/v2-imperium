/**
 * Imperium backend connection config.
 *
 * Resolution order:
 *  1. localStorage override (set from the Settings page)
 *  2. VITE_IMPERIUM_API_BASE_URL build-time env
 *  3. http://localhost:8000 default (matches main.py IMPERIUM_PORT)
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
  if (clean.length === 0) {
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    window.localStorage.setItem(STORAGE_KEY, clean);
  }
}

export function getDefaultBaseUrl(): string {
  return DEFAULT_BASE_URL.replace(/\/+$/, "");
}

export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/** Real, backend-supported sources (per discovery.py investigation). */
export const REAL_SOURCES = [
  { id: "remoteok", label: "RemoteOK", requiresKey: false },
  { id: "remotive", label: "Remotive", requiresKey: false },
  { id: "arbeitnow", label: "Arbeitnow", requiresKey: false },
  { id: "hackernews", label: "Hacker News", requiresKey: false },
  { id: "adzuna", label: "Adzuna", requiresKey: true },
  { id: "jsearch", label: "JSearch", requiresKey: true },
] as const;

export type SourceId = (typeof REAL_SOURCES)[number]["id"];
