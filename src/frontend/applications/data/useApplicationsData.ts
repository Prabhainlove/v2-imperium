/**
 * useApplicationsData — TanStack-Query source of truth for the Application
 * Tracker. Reads applications + timeline events from Supabase via auth-protected
 * server functions, maps them through `applicationsAdapter`, and pushes the
 * normalized result into `useApplicationsStore` so existing UI components
 * continue to read from a single in-memory snapshot.
 *
 * Also performs a one-time migration of legacy localStorage application data
 * into Supabase, guarded by an idempotent marker key.
 */
import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getApplications,
  getAllApplicationTimeline,
  createApplicationFromResumeStudio,
} from "@backend/api/imperium.api";
import { useApplicationsStore } from "../state/useApplicationsStore";
import {
  backendToApplication,
  backendToEvent,
  type BackendAppDto,
  type BackendTimelineDto,
} from "./applicationsAdapter";
import { useUserId } from "@frontend/auth/session";

export const APPLICATIONS_QK = ["applications", "list"] as const;
export const TIMELINE_QK = ["applications", "timeline"] as const;

export function useApplicationsQuery() {
  const fetchApps = useServerFn(getApplications);
  const userId = useUserId();
  return useQuery({
    queryKey: [...APPLICATIONS_QK, userId ?? "anon"],
    enabled: !!userId,
    queryFn: async () => {
      const rows = (await fetchApps({ data: { limit: 200 } })) as BackendAppDto[];
      return rows.map(backendToApplication);
    },
    staleTime: 15_000,
  });
}

export function useTimelineQuery() {
  const fetchTimeline = useServerFn(getAllApplicationTimeline);
  const userId = useUserId();
  return useQuery({
    queryKey: [...TIMELINE_QK, userId ?? "anon"],
    enabled: !!userId,
    queryFn: async () => {
      const rows = (await fetchTimeline({})) as BackendTimelineDto[];
      return rows.map(backendToEvent);
    },
    staleTime: 15_000,
  });
}

const MIGRATION_MARKER = "imperium-applications-migration-v1";
const LEGACY_APPS_KEY = "imperium-applications";
const LEGACY_EVT_KEY = "imperium-application-events";

interface LegacyAppShape {
  id?: string;
  company?: string;
  role?: string;
  location?: string;
  source?: string;
  appliedAt?: string;
  status?: string;
  atsScore?: number;
  matchScore?: number;
  resumeId?: string;
  resumeVersion?: string;
  templateUsed?: string;
  sourceUrl?: string;
  notes?: string;
  agentRunId?: string;
  jobSnapshot?: { salary?: string; description?: string };
}

/**
 * One-time migration: import any pre-existing localStorage applications into
 * Supabase. Runs at most once per browser (marker key), then clears legacy
 * keys so storage doesn't drift back into use. Failures are swallowed and
 * marker is set anyway to prevent infinite retries.
 */
function useLegacyLocalMigration(userId: string | null): { running: boolean } {
  const create = useServerFn(createApplicationFromResumeStudio);
  const ref = useRef(false);
  const runningRef = useRef(false);

  useEffect(() => {
    if (!userId || ref.current) return;
    if (typeof localStorage === "undefined") return;
    if (localStorage.getItem(MIGRATION_MARKER)) return;
    const raw = localStorage.getItem(LEGACY_APPS_KEY);
    if (!raw) {
      localStorage.setItem(MIGRATION_MARKER, new Date().toISOString());
      return;
    }
    ref.current = true;
    runningRef.current = true;

    (async () => {
      let imported = 0;
      try {
        const apps = JSON.parse(raw) as LegacyAppShape[];
        if (Array.isArray(apps)) {
          for (const a of apps) {
            try {
              await create({
                data: {
                  company: a.company ?? "Unknown",
                  role: a.role ?? "Unknown Role",
                  location: a.location ?? "",
                  salary: a.jobSnapshot?.salary,
                  source: a.source,
                  sourceUrl: a.sourceUrl,
                  description: a.jobSnapshot?.description,
                  status: a.status,
                  atsScore: a.atsScore,
                  matchScore: a.matchScore,
                  resumeId: a.resumeId,
                  resumeVersion: a.resumeVersion,
                  templateUsed: a.templateUsed,
                  origin: "resume_studio",
                  agentRunId: a.agentRunId,
                  appliedAt: a.appliedAt,
                },
              });
              imported++;
            } catch { /* skip individual failure */ }
          }
        }
      } catch { /* malformed legacy payload */ }
      localStorage.setItem(MIGRATION_MARKER, JSON.stringify({ at: new Date().toISOString(), imported }));
      try {
        localStorage.removeItem(LEGACY_APPS_KEY);
        localStorage.removeItem(LEGACY_EVT_KEY);
      } catch { /* quota */ }
      runningRef.current = false;
    })();
  }, [userId, create]);

  return { running: runningRef.current };
}

/**
 * Hydrate `useApplicationsStore` from Supabase. Call once per top-level
 * Application Tracker view (ApplicationsPage / ActivityPage).
 */
export function useApplicationsSync(): { loading: boolean } {
  const userId = useUserId();
  useLegacyLocalMigration(userId);
  const appsQ = useApplicationsQuery();
  const evtsQ = useTimelineQuery();

  useEffect(() => {
    if (appsQ.data) {
      useApplicationsStore.setState({ applications: appsQ.data });
    }
  }, [appsQ.data]);
  useEffect(() => {
    if (evtsQ.data) {
      useApplicationsStore.setState({ events: evtsQ.data });
    }
  }, [evtsQ.data]);

  return { loading: appsQ.isLoading || evtsQ.isLoading };
}

export function useInvalidateApplications() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: APPLICATIONS_QK });
    qc.invalidateQueries({ queryKey: TIMELINE_QK });
  };
}
