/**
 * ApplicationRepository — storage abstraction.
 * Default implementation is LocalApplicationRepository (localStorage).
 * Future Supabase swap requires zero UI change.
 */
import type { Application, ApplicationEvent } from "../schema";

export interface ApplicationRepository {
  loadApplications(): Application[];
  saveApplications(apps: Application[]): void;
  loadEvents(): ApplicationEvent[];
  saveEvents(events: ApplicationEvent[]): void;
}

const APP_KEY = "imperium-applications";
const EVT_KEY = "imperium-application-events";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export class LocalApplicationRepository implements ApplicationRepository {
  loadApplications(): Application[] {
    if (typeof localStorage === "undefined") return [];
    return safeParse<Application[]>(localStorage.getItem(APP_KEY), []);
  }
  saveApplications(apps: Application[]): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(APP_KEY, JSON.stringify(apps));
    } catch {
      /* quota */
    }
  }
  loadEvents(): ApplicationEvent[] {
    if (typeof localStorage === "undefined") return [];
    return safeParse<ApplicationEvent[]>(localStorage.getItem(EVT_KEY), []);
  }
  saveEvents(events: ApplicationEvent[]): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(EVT_KEY, JSON.stringify(events));
    } catch {
      /* quota */
    }
  }
}

export const defaultApplicationRepository: ApplicationRepository =
  new LocalApplicationRepository();
