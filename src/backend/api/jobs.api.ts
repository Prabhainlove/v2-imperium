/**
 * Job Discovery Engine — TanStack server functions.
 * Thin orchestration layer; every step lives in a focused service.
 *
 * Flow:  discoverJobs → retrieve → normalize+rank → cache → log history
 *        getDiscoveredJob → read cached row
 *        selectJobForResume → stage handoff for Resume Studio
 *        getProfileMetrics → live left-rail metrics
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@backend/database/AuthMiddleware";
import { retrieveJobs } from "@backend/jobs/JobRetrievalService.server";
import { normalizeMany, normalizeJob, selectTop5, type NormalizedJob } from "@backend/jobs/JobNormalizationService.server";
import { cacheDiscovered, clearDiscoveredCache, readCachedJob, sweepStaleCache } from "@backend/jobs/JobCacheService.server";
import { selectJob } from "@backend/jobs/JobSelectionService.server";
import { logSearch } from "@backend/jobs/SearchHistoryService.server";
import type { CandidateContext, ExperienceBucket } from "@backend/jobs/JobRankingService.server";

const ExperienceBucketEnum = z.enum(["fresher", "0-2", "3-5", "5+"]);

const DiscoverInput = z.object({
  title: z.string().max(200).default(""),
  skills: z.string().max(500).default(""),
  location: z.string().max(200).default(""),
  experience: z.union([ExperienceBucketEnum, z.literal("")]).default(""),
  workMode: z.string().max(50).default(""),
  salaryMin: z.number().int().min(0).max(100_000_000).nullable().optional(),
});

type DiscoverFilters = z.infer<typeof DiscoverInput>;

async function loadProfile(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("name, target_role, headline, skills, experience, education, location, salary_expectation")
    .eq("id", userId)
    .maybeSingle();
  return data ?? null;
}

function buildCandidateContext(profile: any, filters: Partial<DiscoverFilters>): CandidateContext {
  const profileSkills = Array.isArray(profile?.skills) ? (profile.skills as string[]) : [];
  const formSkills = (filters.skills ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const merged = Array.from(new Set([...profileSkills, ...formSkills].map((s) => s.trim()).filter(Boolean)));
  const role = filters.title || profile?.target_role || profile?.headline || "Software Engineer";
  const location = filters.location || profile?.location || "Remote";
  const desiredSalaryMin = filters.salaryMin ?? (profile?.salary_expectation?.min as number | undefined) ?? null;
  const bucket: ExperienceBucket | null = filters.experience ? (filters.experience as ExperienceBucket) : null;
  return { role, skills: merged, experience: "", experienceBucket: bucket, location, desiredSalaryMin };
}

export const discoverJobs = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => DiscoverInput.parse(i ?? {}))
  .handler(async ({ data }) => {
    const taskId = `disc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    // Mock-auth build: no Supabase session/profile available server-side.
    // Build the candidate context from the form filters only.
    const candidate = buildCandidateContext(null, data);

    const { jobs: raws, perSource } = await retrieveJobs(candidate.role, candidate.location);
    let normalized = normalizeMany(raws, candidate);

    if (candidate.experienceBucket) {
      normalized = normalized.filter(
        (j) => j.experienceBucket == null || j.experienceBucket === candidate.experienceBucket,
      );
    }
    if (candidate.desiredSalaryMin && candidate.desiredSalaryMin > 0) {
      normalized = normalized.filter((j) => {
        const cap = j.salaryMax ?? j.salaryMin;
        return cap == null || cap >= candidate.desiredSalaryMin!;
      });
    }
    const mode = (data.workMode || "").toLowerCase();
    if (mode === "remote") normalized = normalized.filter((j) => j.remote);
    else if (mode === "onsite") normalized = normalized.filter((j) => !j.remote);

    // Synthesize ids for client-side selection (no DB cache in mock-auth mode).
    const cached = normalized.map((j, idx) => ({
      ...j,
      id: `${taskId}_${idx}`,
    }));

    return {
      taskId,
      cachedAt: new Date().toISOString(),
      top5: selectTop5(cached),
      all: cached,
      perSource,
      candidate: { role: candidate.role, location: candidate.location, skills: candidate.skills },
    };
  });


const JobIdInput = z.object({ jobId: z.string().min(1) });

export const getDiscoveredJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => JobIdInput.parse(i))
  .handler(async ({ data, context }): Promise<NormalizedJob | null> => {
    const { supabase, userId } = context;
    const row = await readCachedJob(supabase, userId, data.jobId);
    if (!row) return null;

    const profile = await loadProfile(supabase, userId);
    const candidate = buildCandidateContext(profile, {});

    const raw = {
      source: row.source as string,
      external_id: row.external_id as string,
      url: (row.url as string) ?? "",
      title: (row.title as string) ?? "",
      company: (row.company as string) ?? "",
      location: (row.location as string) ?? "",
      remote: Boolean(row.remote),
      description: (row.description as string) ?? "",
      tech_stack: (row.tech_stack as string[] | null) ?? [],
      salary_min: row.salary_min as number | null,
      salary_max: row.salary_max as number | null,
      salary_currency: (row.salary_currency as string) ?? "USD",
      posted_at: row.posted_at as string | null,
    };
    const job = normalizeJob(raw, candidate);
    // CONSISTENCY: the score shown to the user was computed once during
    // discovery with their full search context. Re-ranking here would use
    // an empty filter context (no skills/experience) and produce a different
    // number — the source of the "card 65% vs panel 11%" bug. Overlay the
    // stored value so every surface displays the same percentage.
    const cachedScore = typeof row.match_score === "number" ? Number(row.match_score) : null;
    const matchScore = cachedScore != null ? cachedScore : job.matchScore;
    return { ...job, id: row.id as string, matchScore };
  });


export const selectJobForResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => JobIdInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let selectionId: string | undefined;
    try {
      const sel = await selectJob(supabase, userId, data.jobId);
      selectionId = sel?.id;
    } catch { /* selected_jobs table may not exist yet — still proceed to Resume Studio */ }
    return { ok: true, selectionId, jobId: data.jobId, redirect: `/resume?jobId=${data.jobId}` };
  });

export const getProfileMetrics = createServerFn({ method: "GET" })
  .handler(async () => {
    // Mock-auth build: no Supabase session on the server. Return demo metrics
    // sourced from the Dinesh demo profile so the Jobs left-rail stays populated.
    return {
      profileStrength: 86,
      atsReadiness: 78,
      resumeQuality: 82,
      applicationsSubmitted: 0,
      interviewSuccessRate: 0,
    };
  });
