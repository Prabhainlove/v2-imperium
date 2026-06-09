/**
 * Applications store — Zustand. Persists via ApplicationRepository.
 * Only public creator is createFromResumeStudio (and createFromLocalAgent
 * reserved for future use). Status updates always append timeline events.
 */
import { create } from "zustand";
import {
  type Application,
  type ApplicationEvent,
  type ApplicationStatus,
  type ApplicationSourcePortal,
  type ApplicationOrigin,
  type JobSnapshot,
  STATUS_LABEL,
  newApplicationId,
  newEventId,
  hashString,
} from "../schema";
import {
  defaultApplicationRepository,
  type ApplicationRepository,
} from "./repository";
import { computeIntelligence, withIntelligence } from "../intelligence/ApplicationIntelligenceEngine";

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
  // mutations
  createFromResumeStudio: (p: CreateFromResumeStudioPayload) => Application;
  updateStatus: (id: string, status: ApplicationStatus) => void;
  updateNotes: (id: string, notes: string) => void;
  selectApplication: (id: string | null) => void;
  setSearch: (s: string) => void;
  setFilter: (f: Partial<ApplicationsState["filter"]>) => void;
  clearFilter: () => void;
  // dev helper
  _seedDemo: () => void;
}

const repo: ApplicationRepository = defaultApplicationRepository;

const initialApps = repo.loadApplications();
const initialEvents = repo.loadEvents();

function persist(apps: Application[], events: ApplicationEvent[]): void {
  repo.saveApplications(apps);
  repo.saveEvents(events);
}

function nowIso(): string {
  return new Date().toISOString();
}

function buildSnapshot(job: CreateFromResumeStudioPayload["job"]): JobSnapshot {
  return {
    title: job.title,
    company: job.company,
    location: job.location ?? "",
    salary: job.salary,
    source: job.source ?? "other",
    descriptionHash: hashString(job.description ?? ""),
  };
}

export const useApplicationsStore = create<ApplicationsState>()((set, get) => ({
  applications: initialApps,
  events: initialEvents,
  selectedId: null,
  search: "",
  filter: {},

  createFromResumeStudio: (p) => {
    const now = nowIso();
    const id = newApplicationId();
    const base: Application = {
      id,
      company: p.job.company,
      role: p.job.title,
      location: p.job.location ?? "",
      source: p.job.source ?? "other",
      applicationSource: p.origin ?? "resume_studio",
      appliedAt: now,
      status: "applied",
      atsScore: p.atsScore,
      matchScore: p.matchScore,
      resumeId: p.resume.resumeId,
      resumeVersion: p.resume.resumeVersion,
      templateUsed: p.resume.templateUsed,
      sourceUrl: p.job.sourceUrl,
      agentRunId: p.agentRunId,
      jobSnapshot: buildSnapshot(p.job),
      intelligence: { ageDays: 0, stale: false, responseProbability: 0.5, nextRecommendedAction: "Wait for response" },
      createdAt: now,
      updatedAt: now,
    };
    const app = withIntelligence(base);
    const evt: ApplicationEvent = {
      id: newEventId(),
      applicationId: id,
      type: "application_submitted",
      title: "Application submitted",
      description: `Applied to ${p.job.title} at ${p.job.company}`,
      timestamp: now,
    };
    const applications = [app, ...get().applications];
    const events = [evt, ...get().events];
    persist(applications, events);
    set({ applications, events });
    return app;
  },

  updateStatus: (id, status) => {
    const now = nowIso();
    let changed: Application | null = null;
    const applications = get().applications.map((a) => {
      if (a.id !== id || a.status === status) return a;
      const next: Application = { ...a, status, updatedAt: now };
      const withIntel = withIntelligence(next);
      changed = withIntel;
      return withIntel;
    });
    if (!changed) return;
    const evt: ApplicationEvent = {
      id: newEventId(),
      applicationId: id,
      type:
        status === "interview"
          ? "interview_scheduled"
          : status === "offer"
          ? "offer_received"
          : status === "rejected"
          ? "rejected"
          : status === "withdrawn"
          ? "withdrawn"
          : "status_changed",
      title: `Status → ${STATUS_LABEL[status]}`,
      timestamp: now,
    };
    const events = [evt, ...get().events];
    persist(applications, events);
    set({ applications, events });
  },

  updateNotes: (id, notes) => {
    const now = nowIso();
    const applications = get().applications.map((a) =>
      a.id === id ? { ...a, notes, updatedAt: now } : a,
    );
    persist(applications, get().events);
    set({ applications });
  },

  selectApplication: (id) => set({ selectedId: id }),
  setSearch: (s) => set({ search: s }),
  setFilter: (f) => set((s) => ({ filter: { ...s.filter, ...f } })),
  clearFilter: () => set({ filter: {} }),

  _seedDemo: () => {
    // Demo seeding disabled (Phase 2 cleanup). Application Tracker now reads
    // exclusively from real persisted applications. Demo data will be removed
    // entirely in Phase 6 when this store is replaced by Supabase reads.
    if (get().applications.length > 0) return;
    const samples: CreateFromResumeStudioPayload[] = [
      { job: { title: "Frontend Developer", company: "Imperium Labs", location: "Hyderabad", salary: "₹12-18L", source: "linkedin", sourceUrl: "https://linkedin.com", description: "React TypeScript Node.js" }, resume: { resumeId: "r1", resumeVersion: "V4", templateUsed: "professional" }, atsScore: 92, matchScore: 88 },
      { job: { title: "Software Engineer", company: "Imperium Cloud", location: "Remote", salary: "₹15-22L", source: "wellfound", description: "React TypeScript design systems" }, resume: { resumeId: "r1", resumeVersion: "V4", templateUsed: "modern" }, atsScore: 88, matchScore: 81 },
      { job: { title: "Product Engineer", company: "Imperium Studio", location: "Bangalore", source: "naukri", description: "Node.js React PostgreSQL" }, resume: { resumeId: "r1", resumeVersion: "V3", templateUsed: "professional" }, atsScore: 78, matchScore: 72 },
      { job: { title: "Backend Engineer", company: "Imperium Systems", location: "Bangalore", source: "foundit", description: "Java Spring Microservices" }, resume: { resumeId: "r1", resumeVersion: "V2", templateUsed: "classic-ats" }, atsScore: 71, matchScore: 60 },
      { job: { title: "Platform Engineer", company: "Imperium Core", location: "Bangalore", source: "instahyre", description: "Go Kubernetes AWS Terraform" }, resume: { resumeId: "r1", resumeVersion: "V4", templateUsed: "developer" }, atsScore: 90, matchScore: 84 },
      { job: { title: "Full Stack Engineer", company: "Imperium AI", location: "Bangalore", source: "linkedin", description: "Java Distributed systems" }, resume: { resumeId: "r1", resumeVersion: "V3", templateUsed: "professional" }, atsScore: 82, matchScore: 75 },
    ];
    const created = samples.map((s) => get().createFromResumeStudio(s));
    // Mutate ages and statuses for richer demo
    const now = Date.now();
    const tweaks: Array<[number, ApplicationStatus, number]> = [
      [0, "interview", 12],
      [1, "under_review", 5],
      [2, "viewed", 9],
      [3, "rejected", 25],
      [4, "offer", 18],
      [5, "applied", 23],
    ];
    const apps = get().applications.map((a) => {
      const idx = created.findIndex((c) => c.id === a.id);
      const t = tweaks[idx];
      if (!t) return a;
      const [, status, daysAgo] = t;
      const appliedAt = new Date(now - daysAgo * 86400000).toISOString();
      return withIntelligence({ ...a, status, appliedAt, updatedAt: appliedAt });
    });
    repo.saveApplications(apps);
    set({ applications: apps });
  },
}));

// Selectors (pure functions over state)

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
  // Cumulative: everyone who reached at least this stage
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
