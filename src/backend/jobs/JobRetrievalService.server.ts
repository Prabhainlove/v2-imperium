/**
 * JobRetrievalService — fans out a search across every available job source
 * (LinkedIn public, RemoteOK, Remotive, Arbeitnow, Naukri, Adzuna, Jooble).
 * Pure I/O: returns RawJob[] + per-source status. No scoring, no persistence.
 */
import { SOURCES, type RawJob } from "@backend/jobs/JobSources.server";

export interface SourceStatus {
  id: string;
  label: string;
  status: "ok" | "failed" | "skipped";
  count: number;
  error?: string;
}

export interface RetrievalResult {
  jobs: RawJob[];
  perSource: SourceStatus[];
}

export async function retrieveJobs(role: string, location: string): Promise<RetrievalResult> {
  const jobs: RawJob[] = [];
  const perSource: SourceStatus[] = [];

  await Promise.all(
    SOURCES.map(async (src) => {
      if (!src.isAvailable()) {
        perSource.push({ id: src.id, label: src.label, status: "skipped", count: 0 });
        return;
      }
      try {
        const fetched = await src.fetch(role, location);
        jobs.push(...fetched);
        perSource.push({ id: src.id, label: src.label, status: "ok", count: fetched.length });
      } catch (err) {
        perSource.push({
          id: src.id,
          label: src.label,
          status: "failed",
          count: 0,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }),
  );

  const seen = new Set<string>();
  const unique = jobs.filter((j) => {
    const k = `${j.source}:${j.external_id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return { jobs: unique, perSource };
}
