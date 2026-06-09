/**
 * JobRetrievalService — fans out a search across every available source,
 * then expands the location (city → state → country → remote) if the
 * initial pass returns fewer than `expansionThreshold` unique jobs.
 *
 * Returns RawJob[] + per-source status. Pure I/O — no scoring or persistence.
 */
import { SOURCES, type RawJob } from "@backend/jobs/JobSources.server";

export interface SourceStatus {
  id: string;
  label: string;
  status: "ok" | "failed" | "skipped";
  count: number;
  error?: string;
  /** Locations tried for this source across expansion levels. */
  locationsTried?: string[];
}

export interface RetrievalResult {
  jobs: RawJob[];
  perSource: SourceStatus[];
  expansionsUsed: string[];
}

// Indian state map for expansion. Lowercase keys.
const IN_CITY_TO_STATE: Record<string, string> = {
  hyderabad: "Telangana",
  secunderabad: "Telangana",
  bangalore: "Karnataka",
  bengaluru: "Karnataka",
  mumbai: "Maharashtra",
  pune: "Maharashtra",
  delhi: "Delhi NCR",
  "new delhi": "Delhi NCR",
  gurgaon: "Delhi NCR",
  gurugram: "Delhi NCR",
  noida: "Delhi NCR",
  chennai: "Tamil Nadu",
  kolkata: "West Bengal",
  ahmedabad: "Gujarat",
  kochi: "Kerala",
  jaipur: "Rajasthan",
  indore: "Madhya Pradesh",
  coimbatore: "Tamil Nadu",
};

function expansionLevels(location: string): string[] {
  const l = (location || "").trim();
  if (!l) return [""];
  const lower = l.toLowerCase();
  const state = IN_CITY_TO_STATE[lower];
  const levels = [l];
  if (state && !levels.includes(state)) levels.push(state);
  if (state || /india|bangalore|hyderabad|mumbai|delhi|chennai|pune|kolkata/.test(lower)) {
    if (!levels.includes("India")) levels.push("India");
    if (!levels.includes("Remote India")) levels.push("Remote India");
  } else {
    levels.push("Remote");
  }
  return levels;
}

export async function retrieveJobs(
  role: string,
  location: string,
  opts: { expansionThreshold?: number } = {},
): Promise<RetrievalResult> {
  const threshold = opts.expansionThreshold ?? 5;
  const levels = expansionLevels(location);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();
  const expansionsUsed: string[] = [];

  // Aggregate per-source counts and statuses across levels.
  const sourceAgg = new Map<string, SourceStatus>();
  for (const src of SOURCES) {
    sourceAgg.set(src.id, {
      id: src.id,
      label: src.label,
      status: src.isAvailable() ? "ok" : "skipped",
      count: 0,
      locationsTried: [],
    });
  }

  for (const lvl of levels) {
    expansionsUsed.push(lvl);
    await Promise.all(
      SOURCES.map(async (src) => {
        const status = sourceAgg.get(src.id)!;
        if (!src.isAvailable()) return;
        status.locationsTried!.push(lvl);
        try {
          const fetched = await src.fetch(role, lvl);
          let added = 0;
          for (const j of fetched) {
            const k = `${j.source}:${j.external_id}`;
            if (seen.has(k)) continue;
            seen.add(k);
            jobs.push(j);
            added++;
          }
          status.count += added;
        } catch (err) {
          status.status = "failed";
          status.error = err instanceof Error ? err.message : String(err);
        }
      }),
    );
    if (jobs.length >= threshold) break; // enough — stop expanding
  }

  return { jobs, perSource: Array.from(sourceAgg.values()), expansionsUsed };
}
