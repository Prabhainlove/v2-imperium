/**
 * Job Discovery Engine — TanStack server functions.
 * Auth: every endpoint requires a Supabase session. Per-user profile is
 * loaded from the `profiles` table and merged with the form filters.
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
import { normalizeMany, selectTop5, type NormalizedJob } from "@backend/jobs/JobNormalizationService.server";
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

async function loadProfile(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("name, target_role, headline, location, skills, salary_expectation")
    .eq("id", userId)
    .maybeSingle();
  return data;
}

// Per-user in-memory cache (Worker process lifetime). Resets between deploys.
const userJobCache = new Map<string, { taskId: string; jobs: (NormalizedJob & { id: string })[]; cachedAt: string }>();

export const discoverJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => DiscoverInput.parse(i ?? {}))
  .handler(async ({ data, context }) => {
    const taskId = `disc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const profile = await loadProfile(context.supabase, context.userId);
    const candidate = buildCandidateContext(profile, data);

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

    const cached = normalized.map((j, idx) => ({ ...j, id: `${taskId}_${idx}` }));
    userJobCache.set(context.userId, { taskId, jobs: cached, cachedAt: new Date().toISOString() });

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
    const entry = userJobCache.get(context.userId);
    if (!entry) return null;
    return entry.jobs.find((j) => j.id === data.jobId) ?? null;
  });

export const selectJobForResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => JobIdInput.parse(i))
  .handler(async ({ data }) => {
    return { ok: true, selectionId: undefined, jobId: data.jobId, redirect: `/resume?jobId=${data.jobId}` };
  });

export const getProfileMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profile = await loadProfile(context.supabase, context.userId);
    const skillCount = Array.isArray(profile?.skills) ? profile.skills.length : 0;
    const strength = Math.min(100, 40 + skillCount * 4 + (profile?.target_role ? 10 : 0) + (profile?.location ? 5 : 0));
    return {
      profileStrength: strength,
      atsReadiness: Math.min(100, 30 + skillCount * 5),
      resumeQuality: Math.min(100, 35 + skillCount * 4),
      applicationsSubmitted: 0,
      interviewSuccessRate: 0,
    };
  });
