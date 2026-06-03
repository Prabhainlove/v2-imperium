/**
 * Imperium server functions — TanStack Start RPCs called from the React UI.
 * All Supabase admin access lives inside .handler() bodies so the server-only
 * module never leaks into the client bundle.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/* ---------- Health ---------- */

export const getHealth = createServerFn({ method: "GET" }).handler(async () => {
  return {
    status: "healthy",
    kernel_running: true,
    agents_count: 1,
    version: "imperium-cloud-1.0",
  };
});

/* ---------- Agents ---------- */

export const getAgents = createServerFn({ method: "GET" }).handler(async () => {
  return [
    {
      name: "JobAgent",
      capabilities: ["discover", "analyze", "resume", "cover_letter", "track"],
      skills: ["RemoteOK", "Remotive", "Arbeitnow", "Lovable AI"],
      status: "ready",
    },
  ];
});

/* ---------- Profile ---------- */

export const getProfile = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("candidate_profiles")
    .select("*")
    .eq("id", "default")
    .maybeSingle();
  if (error) throw new Error(error.message);

  const skills = ((data?.skills as string[] | null) ?? []) as string[];
  const profile = data
    ? {
        profile_id: "default",
        name: data.name,
        email: data.email,
        phone: data.phone,
        location: data.location,
        skills,
        target_roles: data.headline ? [data.headline] : [],
        preferred_locations: data.location ? [data.location] : [],
        remote_only: false,
        work_experience: ((data.experience as Record<string, unknown>[]) ?? []) as Record<string, unknown>[],
        education: ((data.education as Record<string, unknown>[]) ?? []) as Record<string, unknown>[],
      }
    : null;

  const checks = {
    name: !!data?.name && data.name !== "Candidate",
    email: !!data?.email,
    skills: skills.length > 0,
    summary: !!data?.summary,
    location: !!data?.location,
  };
  const passed = Object.values(checks).filter(Boolean).length;
  const missing = Object.entries(checks)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  return {
    status: "ok",
    profile,
    profile_health: {
      score: passed / Object.keys(checks).length,
      checks,
      missing,
    },
  };
});

const SaveProfileInput = z
  .object({
    name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    location: z.string().optional(),
    headline: z.string().optional(),
    summary: z.string().optional(),
    skills: z.array(z.string()).optional(),
    target_roles: z.array(z.string()).optional(),
  })
  .passthrough();

export const saveProfile = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SaveProfileInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const update: Record<string, unknown> = { id: "default", updated_at: new Date().toISOString() };
    if (data.name !== undefined) update.name = data.name;
    if (data.email !== undefined) update.email = data.email;
    if (data.phone !== undefined) update.phone = data.phone;
    if (data.location !== undefined) update.location = data.location;
    if (data.headline !== undefined) update.headline = data.headline;
    else if (data.target_roles?.[0]) update.headline = data.target_roles[0];
    if (data.summary !== undefined) update.summary = data.summary;
    if (data.skills !== undefined) update.skills = data.skills;

    const { error } = await supabaseAdmin
      .from("candidate_profiles")
      .upsert(update, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { status: "ok" };
  });

/* ---------- Jobs ---------- */

const ListInput = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  status: z.string().optional(),
  task_id: z.string().optional(),
});

export const getJobs = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => ListInput.parse(input ?? {}))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("job_listings")
      .select("*")
      .order("match_score", { ascending: false })
      .order("discovered_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      listing_id: r.id as string,
      source: r.source,
      url: r.url,
      title: r.title,
      company: r.company,
      location: r.location,
      salary_min: r.salary_min,
      salary_max: r.salary_max,
      salary_currency: r.salary_currency,
      technology_stack: (r.tech_stack as string[] | null) ?? [],
      required_skills: (r.tech_stack as string[] | null) ?? [],
      discovered_at: r.discovered_at,
      posted_at: r.posted_at,
      description: r.description,
      match_score: Number(r.match_score),
      status: r.status,
    }));
  });

/* ---------- Applications ---------- */

export const getApplications = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => ListInput.parse(input ?? {}))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("applications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      application_id: r.id as string,
      listing_id: r.listing_id as string,
      company: r.company,
      job_title: r.job_title,
      date_applied: r.applied_at ?? r.created_at,
      status: r.status,
      match_score: Number(r.match_score),
      resume_path: r.id ? `application:${r.id}:resume` : null,
      cover_letter_path: r.id ? `application:${r.id}:cover` : null,
      last_updated: r.updated_at,
      notes: r.notes,
    }));
  });

/* ---------- Activity ---------- */

export const getActivity = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => ListInput.parse(input ?? {}))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("activity_log")
      .select("*")
      .order("id", { ascending: false })
      .limit(data.limit ?? 100);
    if (data.task_id) q = q.eq("task_id", data.task_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      log_id: Number(r.id),
      task_id: r.task_id,
      agent: r.agent,
      action: r.action,
      status: r.status,
      detail: r.detail,
      created_at: r.created_at,
    }));
  });

/* ---------- Notifications (no-op, kept for UI shape) ---------- */

export const getNotifications = createServerFn({ method: "GET" }).handler(async () => {
  return [] as unknown[];
});

/* ---------- Dashboard ---------- */

export const getDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [jobsCount, appsCount, interviews, recent] = await Promise.all([
    supabaseAdmin.from("job_listings").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("applications").select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("status", "Interview Scheduled"),
    supabaseAdmin
      .from("applications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const recent_applications = (recent.data ?? []).map((r) => ({
    application_id: r.id as string,
    listing_id: r.listing_id as string,
    company: r.company,
    job_title: r.job_title,
    date_applied: r.applied_at ?? r.created_at,
    status: r.status,
    match_score: Number(r.match_score),
    last_updated: r.updated_at,
    notes: r.notes,
  }));

  return {
    metrics: {
      jobs_discovered: jobsCount.count ?? 0,
      total_applications: appsCount.count ?? 0,
      interviews_scheduled: interviews.count ?? 0,
      offers: 0,
    },
    recent_applications,
    strategy: {},
    notifications: [],
    activity: [],
    timestamp: new Date().toISOString(),
  };
});

/* ---------- Artifact (resume / cover letter) ---------- */

const ArtifactInput = z.object({ path: z.string().min(1) });

export const getArtifact = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => ArtifactInput.parse(input))
  .handler(async ({ data }) => {
    const m = data.path.match(/^application:([^:]+):(resume|cover)$/);
    if (!m) throw new Error("Invalid artifact path");
    const [, appId, kind] = m;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("applications")
      .select("resume_md, cover_letter_md")
      .eq("id", appId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Application not found");
    return { content: kind === "resume" ? row.resume_md : row.cover_letter_md };
  });

/* ---------- The pipeline ---------- */

const RunSearchInput = z.object({
  role: z.string().min(1),
  location: z.string().min(1),
  experience: z.string().default(""),
  skills: z.string().default(""),
  name: z.string().default("Candidate"),
  email: z.string().default("candidate@example.com"),
  phone: z.string().default(""),
  company: z.string().default(""),
  max_applications: z.number().int().min(1).max(25).default(8),
  resume_text: z.string().default(""),
});

export const runJobSearch = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => RunSearchInput.parse(input))
  .handler(async ({ data }) => {
    const { runPipeline } = await import("./pipeline.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const task_id = `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    // Persist any candidate info so future runs prefill.
    await supabaseAdmin.from("candidate_profiles").upsert(
      {
        id: "default",
        name: data.name || "Candidate",
        email: data.email || "candidate@example.com",
        phone: data.phone,
        location: data.location,
        headline: data.role,
        summary: data.resume_text.slice(0, 1000),
        skills: data.skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    const skillList = data.skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const result = await runPipeline({
      task_id,
      role: data.role,
      location: data.location,
      experience: data.experience,
      skills: skillList,
      candidate: {
        name: data.name || "Candidate",
        email: data.email || "candidate@example.com",
        phone: data.phone,
        summary: data.resume_text.slice(0, 1000),
      },
      max_applications: data.max_applications,
    });

    return {
      status: "ok",
      task_id: result.task_id,
      mode: "manual",
      message: "Run complete",
      summary: result.summary,
      matches: result.matches.map((m) => ({
        listing_id: m.listing_id,
        title: m.title,
        company: m.company,
        location: m.location,
        source: m.source,
        url: m.url,
        match_score: m.match_score,
        matched_skills: m.matched_skills,
        missing_skills: m.missing_skills,
        resume_path: `application:${m.listing_id}:resume`,
        cover_letter_path: `application:${m.listing_id}:cover`,
        submission_status: "prepared",
        submitted: false,
      })),
      skipped: [],
    };
  });
