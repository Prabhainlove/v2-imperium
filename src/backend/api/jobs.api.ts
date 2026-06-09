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
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => DiscoverInput.parse(i ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const taskId = `disc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    const profile = await loadProfile(supabase, userId);
    const candidate = buildCandidateContext(profile, data);

    await sweepStaleCache(supabase, userId, 24);
    await clearDiscoveredCache(supabase, userId);

    const { jobs: raws, perSource } = await retrieveJobs(candidate.role, candidate.location);
    const normalized = normalizeMany(raws, candidate);
    const cached = await cacheDiscovered(supabase, userId, taskId, normalized, raws);

    try {
      await logSearch(supabase, userId, {
        title: data.title,
        skills: data.skills,
        location: data.location,
        experience: data.experience,
        workMode: data.workMode,
        salaryMin: data.salaryMin ?? null,
      }, cached.length);
    } catch { /* search_history table may not exist yet — non-fatal */ }

    return {
      taskId,
      cachedAt: new Date().toISOString(),
      top5: cached.slice(0, 5),
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
    return { ...job, id: row.id as string };
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
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, headline, summary, skills, experience, education, projects, certifications, target_role, linkedin_url, github_url, portfolio_url")
      .eq("id", userId)
      .maybeSingle();

    const fields = [
      profile?.name, profile?.headline, profile?.summary, profile?.target_role,
      profile?.linkedin_url, profile?.github_url,
    ];
    const filled = fields.filter((v) => typeof v === "string" && v.trim().length > 0).length;
    const skillCount = Array.isArray(profile?.skills) ? profile!.skills.length : 0;
    const expCount = Array.isArray(profile?.experience) ? profile!.experience.length : 0;
    const projCount = Array.isArray(profile?.projects) ? profile!.projects.length : 0;
    const eduCount = Array.isArray(profile?.education) ? profile!.education.length : 0;

    const profileStrength = Math.min(100, Math.round((filled / fields.length) * 50 + Math.min(skillCount, 15) * 2 + Math.min(expCount, 5) * 4));
    const atsReadiness = Math.min(100, Math.round(Math.min(skillCount, 20) * 3 + (profile?.summary ? 25 : 0) + Math.min(expCount, 4) * 5));
    const resumeQuality = Math.min(100, Math.round(Math.min(expCount, 5) * 8 + Math.min(projCount, 5) * 6 + Math.min(eduCount, 3) * 5 + (profile?.summary ? 25 : 0)));

    const { count: appsSubmitted } = await supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["Applied", "Interview", "Offer", "Rejected"]);

    const { count: interviewCount } = await supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["Interview", "Offer"]);

    const submitted = appsSubmitted ?? 0;
    const interviews = interviewCount ?? 0;
    const interviewRate = submitted > 0 ? Math.round((interviews / submitted) * 100) : 0;

    return {
      profileStrength,
      atsReadiness,
      resumeQuality,
      applicationsSubmitted: submitted,
      interviewSuccessRate: interviewRate,
    };
  });
