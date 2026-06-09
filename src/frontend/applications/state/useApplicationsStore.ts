/**
 * Applications store — UI state (search, filter, selectedId) plus a thin
 * in-memory snapshot of applications and timeline events that
 * `useApplicationsSync` hydrates from Supabase via TanStack Query.
 *
 * Mutations call the auth-protected server functions directly. After each
 * successful write the store dispatches a window-level event that
 * `useApplicationsSync` listens for to invalidate its queries — keeping
 * Supabase as the source of truth.
 */
import { create } from "zustand";
import {
  type Application,
  type ApplicationEvent,
  type ApplicationStatus,
  type ApplicationSourcePortal,
  type ApplicationOrigin,
  STATUS_LABEL,
} from "../schema";
import {
  createApplicationFromResumeStudio,
  updateApplicationStatus as updateStatusFn,
  updateApplicationNotes as updateNotesFn,
} from "@backend/api/imperium.api";
import { withIntelligence, computeIntelligence } from "../intelligence/ApplicationIntelligenceEngine";
import { backendToApplication, type BackendAppDto } from "../data/applicationsAdapter";

export interface CreateFromResumeStudioPayload {
  job: {
    title: string;
    company: string;
    location?: string;
    salary?: string;
    source?: ApplicationSourcePortal;
    sourceUrl?: string;
    description: string;
  };
  resume: {
    resumeId: string;
    resumeVersion: string;
    templateUsed: string;
  };
  atsScore?: number;
  matchScore?: number;
  origin?: ApplicationOrigin;
  agentRunId?: string;
}

interface ApplicationsState {
  applications: Application[];
  events: ApplicationEvent[];
  selectedId: string | null;
  search: string;
  filter: {
    status?: ApplicationStatus;
    source?: ApplicationSourcePortal;
    resumeVersion?: string;
  };
  createFromResumeStudio: (p: CreateFromResumeStudioPayload) => Promise<Application | null>;
  updateStatus: (id: string, status: ApplicationStatus) => Promise<void>;
  updateNotes: (id: string, notes: string) => Promise<void>;
  selectApplication: (id: string | null) => void;
  setSearch: (s: string) => void;
  setFilter: (f: Partial<ApplicationsState["filter"]>) => void;
  clearFilter: () => void;
  /** No-op retained for backward compatibility; real data now comes from Supabase. */
  _seedDemo: () => void;
}

export const APPLICATIONS_DATA_EVENT = "imperium:applications:invalidate";
function dispatchInvalidate(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(APPLICATIONS_DATA_EVENT));
  }
}

export const useApplicationsStore = create<ApplicationsState>()((set, get) => ({
  applications: [],
  events: [],
  selectedId: null,
  search: "",
  filter: {},

  createFromResumeStudio: async (p) => {
    try {
      const dto = (await createApplicationFromResumeStudio({
        data: {
          company: p.job.company,
          role: p.job.title,
          location: p.job.location,
          salary: p.job.salary,
          source: p.job.source,
          sourceUrl: p.job.sourceUrl,
          description: p.job.description,
          status: "applied",
          atsScore: p.atsScore,
          matchScore: p.matchScore,
          resumeId: p.resume.resumeId,
          resumeVersion: p.resume.resumeVersion,
          templateUsed: p.resume.templateUsed,
          origin: p.origin ?? "resume_studio",
          agentRunId: p.agentRunId,
        },
      })) as BackendAppDto;
      const app = backendToApplication(dto);
      set({ applications: [app, ...get().applications] });
      dispatchInvalidate();
      return app;
    } catch (err) {
      console.error("[applications] createFromResumeStudio failed", err);
      return null;
    }
  },

  updateStatus: async (id, status) => {
    const prev = get().applications.find((a) => a.id === id);
    if (!prev || prev.status === status) return;
    const now = new Date().toISOString();
    // Optimistic update.
    set({
      applications: get().applications.map((a) =>
        a.id === id ? withIntelligence({ ...a, status, updatedAt: now }) : a,
      ),
      events: [
        {
          id: `optimistic_${Date.now().toString(36)}`,
          applicationId: id,
          type:
            status === "interview" ? "interview_scheduled"
              : status === "offer" ? "offer_received"
              : status === "rejected" ? "rejected"
              : status === "withdrawn" ? "withdrawn"
              : "status_changed",
          title: `Status → ${STATUS_LABEL[status]}`,
          timestamp: now,
        },
        ...get().events,
      ],
    });
    try {
      await updateStatusFn({ data: { id, status } });
      dispatchInvalidate();
    } catch (err) {
      console.error("[applications] updateStatus failed", err);
      // Rollback.
      set({
        applications: get().applications.map((a) =>
          a.id === id ? withIntelligence({ ...a, status: prev.status, updatedAt: prev.updatedAt }) : a,
        ),
      });
    }
  },

  updateNotes: async (id, notes) => {
    const before = get().applications.find((a) => a.id === id);
    if (!before) return;
    set({
      applications: get().applications.map((a) =>
        a.id === id ? { ...a, notes, updatedAt: new Date().toISOString() } : a,
      ),
    });
    try {
      await updateNotesFn({ data: { id, note: notes } });
      dispatchInvalidate();
    } catch (err) {
      console.error("[applications] updateNotes failed", err);
    }
  },

  selectApplication: (id) => set({ selectedId: id }),
  setSearch: (s) => set({ search: s }),
  setFilter: (f) => set((s) => ({ filter: { ...s.filter, ...f } })),
  clearFilter: () => set({ filter: {} }),

  _seedDemo: () => {
    // Demo seeding removed in Phase 6: Application Tracker is fully backed by
    // Supabase. Real applications appear after they are created via Resume
    // Studio or the Local Agent.
  },
}));

/* ---------- Selectors (pure functions over state) ---------- */

export interface Kpis {
  sent: number;
  underReview: number;
  interviews: number;
  offers: number;
  responseRate: number;
  interviewRate: number;
  stale: number;
  active: number;
}

const RESPONDED: ReadonlySet<ApplicationStatus> = new Set([
  "viewed",
  "under_review",
  "assessment",
  "interview",
  "offer",
  "rejected",
]);

const ACTIVE: ReadonlySet<ApplicationStatus> = new Set([
  "applied",
  "viewed",
  "under_review",
  "assessment",
  "interview",
  "offer",
]);

export function selectKpis(apps: Application[]): Kpis {
  const total = apps.length;
  const interviews = apps.filter((a) => a.status === "interview").length;
  const offers = apps.filter((a) => a.status === "offer").length;
  const underReview = apps.filter((a) => a.status === "under_review").length;
  const responses = apps.filter((a) => RESPONDED.has(a.status)).length;
  const active = apps.filter((a) => ACTIVE.has(a.status)).length;
  const stale = apps.filter((a) => computeIntelligence(a).stale).length;
  return {
    sent: total,
    underReview,
    interviews,
    offers,
    responseRate: total ? responses / total : 0,
    interviewRate: total ? interviews / total : 0,
    stale,
    active,
  };
}

export interface FunnelData {
  applied: number;
  viewed: number;
  review: number;
  interview: number;
  offer: number;
}

export function selectFunnel(apps: Application[]): FunnelData {
  const at = (s: ApplicationStatus): number => apps.filter((a) => a.status === s).length;
  const reachedReview = apps.filter((a) =>
    ["under_review", "assessment", "interview", "offer"].includes(a.status),
  ).length;
  const reachedInterview = apps.filter((a) => ["interview", "offer"].includes(a.status)).length;
  return {
    applied: apps.length,
    viewed: apps.length - at("applied"),
    review: reachedReview,
    interview: reachedInterview,
    offer: at("offer"),
  };
}

export function selectPipelineBuckets(
  apps: Application[],
): Record<ApplicationStatus, Application[]> {
  const out: Record<ApplicationStatus, Application[]> = {
    applied: [],
    viewed: [],
    under_review: [],
    assessment: [],
    interview: [],
    offer: [],
    rejected: [],
    withdrawn: [],
  };
  for (const a of apps) out[a.status].push(a);
  return out;
}

export interface ResumePerformanceRow {
  resumeVersion: string;
  applications: number;
  avgATS: number;
  avgMatchScore: number;
  interviews: number;
  offers: number;
  interviewRate: number;
}

export function selectResumePerformance(apps: Application[]): ResumePerformanceRow[] {
  const map = new Map<string, Application[]>();
  for (const a of apps) {
    const arr = map.get(a.resumeVersion) ?? [];
    arr.push(a);
    map.set(a.resumeVersion, arr);
  }
  const rows: ResumePerformanceRow[] = [];
  for (const [version, list] of map) {
    const ats = list.filter((a) => typeof a.atsScore === "number");
    const ms = list.filter((a) => typeof a.matchScore === "number");
    const interviews = list.filter((a) => a.status === "interview" || a.status === "offer").length;
    const offers = list.filter((a) => a.status === "offer").length;
    rows.push({
      resumeVersion: version,
      applications: list.length,
      avgATS: ats.length ? Math.round(ats.reduce((s, a) => s + (a.atsScore ?? 0), 0) / ats.length) : 0,
      avgMatchScore: ms.length ? Math.round(ms.reduce((s, a) => s + (a.matchScore ?? 0), 0) / ms.length) : 0,
      interviews,
      offers,
      interviewRate: list.length ? interviews / list.length : 0,
    });
  }
  return rows.sort((a, b) => b.interviewRate - a.interviewRate);
}

export interface SourcePerformanceRow {
  source: ApplicationSourcePortal;
  applications: number;
  responses: number;
  interviews: number;
  offers: number;
  responseRate: number;
}

export function selectSourcePerformance(apps: Application[]): SourcePerformanceRow[] {
  const map = new Map<ApplicationSourcePortal, Application[]>();
  for (const a of apps) {
    const arr = map.get(a.source) ?? [];
    arr.push(a);
    map.set(a.source, arr);
  }
  const rows: SourcePerformanceRow[] = [];
  for (const [source, list] of map) {
    const responses = list.filter((a) => RESPONDED.has(a.status)).length;
    const interviews = list.filter((a) => a.status === "interview" || a.status === "offer").length;
    const offers = list.filter((a) => a.status === "offer").length;
    rows.push({
      source,
      applications: list.length,
      responses,
      interviews,
      offers,
      responseRate: list.length ? responses / list.length : 0,
    });
  }
  return rows.sort((a, b) => b.responseRate - a.responseRate);
}

export function selectActivityFeed(events: ApplicationEvent[], limit = 20): ApplicationEvent[] {
  return [...events]
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, limit);
}
