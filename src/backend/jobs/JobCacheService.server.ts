/**
 * JobCacheService — temporary store for discovered jobs in `job_listings`
 * with status='discovered'. New searches wipe the prior batch; a 24h sweep
 * keeps the cache from growing forever. Listings attached to applications
 * are never touched.
 */
import type { NormalizedJob } from "@backend/jobs/JobNormalizationService.server";
import type { RawJob } from "@backend/jobs/JobSources.server";

type Db = { from: (t: string) => any };

export async function clearDiscoveredCache(db: Db, userId: string) {
  await db.from("job_listings").delete().eq("user_id", userId).in("status", ["discovered"]);
}

export async function sweepStaleCache(db: Db, userId: string, ttlHours = 24) {
  const cutoff = new Date(Date.now() - ttlHours * 3600 * 1000).toISOString();
  await db
    .from("job_listings")
    .delete()
    .eq("user_id", userId)
    .eq("status", "discovered")
    .lt("discovered_at", cutoff);
}

/** Persists discovered jobs and returns the db id mapped onto each NormalizedJob. */
export async function cacheDiscovered(
  db: Db,
  userId: string,
  taskId: string,
  jobs: NormalizedJob[],
  raws: RawJob[],
): Promise<NormalizedJob[]> {
  const rawByKey = new Map(raws.map((r) => [`${r.source}:${r.external_id}`, r]));
  const out: NormalizedJob[] = [];

  for (const j of jobs) {
    const raw = rawByKey.get(`${j.source}:${j.externalId}`);
    if (!raw) continue;
    const { data, error } = await db
      .from("job_listings")
      .upsert(
        {
          source: raw.source,
          external_id: raw.external_id,
          url: raw.url,
          title: raw.title,
          company: raw.company,
          location: raw.location,
          remote: raw.remote,
          salary_min: raw.salary_min,
          salary_max: raw.salary_max,
          salary_currency: raw.salary_currency,
          tech_stack: raw.tech_stack,
          description: raw.description,
          posted_at: raw.posted_at,
          match_score: Number(j.matchScore.toFixed(3)),
          status: "discovered",
          task_id: taskId,
          user_id: userId,
        },
        { onConflict: "source,external_id" },
      )
      .select("id")
      .single();
    if (!error && data?.id) out.push({ ...j, id: data.id as string });
    else out.push(j);
  }
  return out;
}

export async function readCachedJob(db: Db, userId: string, jobId: string) {
  const { data } = await db
    .from("job_listings")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}
