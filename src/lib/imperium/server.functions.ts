/**
 * Imperium server functions — TanStack Start RPCs called from the React UI.
 * All data-touching functions are auth-protected and scoped per user.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ---------- Health (public) ---------- */
export const getHealth = createServerFn({ method: "GET" }).handler(async () => ({
  status: "healthy",
  kernel_running: true,
  agents_count: 1,
  version: "imperium-cloud-3.0",
}));

/* ---------- Agents (public) ---------- */
export const getAgents = createServerFn({ method: "GET" }).handler(async () => [
  {
    name: "JobAgent",
    capabilities: ["discover", "analyze", "resume", "cover_letter", "review", "track"],
    skills: ["RemoteOK", "Remotive", "Arbeitnow", "Adzuna", "Jooble", "LinkedIn", "Lovable AI"],
    status: "ready",
  },
]);

/* ---------- Profile (V2 — source of truth) ---------- */
const PROFILE_V2_COLUMNS = [
  "id", "name", "email", "phone", "location", "headline", "summary",
  "target_role", "seniority", "work_mode", "target_locations", "salary_expectation",
  "skills", "experience", "education", "projects", "certifications",
  "languages", "achievements",
  "linkedin_url", "github_url", "portfolio_url",
  "github_intel", "linkedin_intel", "profile_intel",
  "onboarded",
].join(",");

function rowToProfile(userId: string, data: Record<string, unknown> | null) {
  if (!data) return null;
  const arr = <T = unknown>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const obj = (v: unknown): Record<string, unknown> =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  return {
    id: userId,
    name: (data.name as string) ?? "",
    email: (data.email as string) ?? "",
    phone: (data.phone as string) ?? "",
    location: (data.location as string) ?? "",
    headline: (data.headline as string) ?? "",
    summary: (data.summary as string) ?? "",
    target_role: (data.target_role as string) ?? "",
    seniority: (data.seniority as string) ?? "",
    work_mode: (data.work_mode as string) ?? "",
    target_locations: arr<string>(data.target_locations),
    salary_expectation: obj(data.salary_expectation),
    skills: arr<string>(data.skills),
    experience: arr(data.experience),
    education: arr(data.education),
    projects: arr(data.projects),
    certifications: arr(data.certifications),
    languages: arr(data.languages),
    achievements: arr<string>(data.achievements),
    linkedin_url: (data.linkedin_url as string) ?? "",
    github_url: (data.github_url as string) ?? "",
    portfolio_url: (data.portfolio_url as string) ?? "",
    github_intel: obj(data.github_intel),
    linkedin_intel: obj(data.linkedin_intel),
    profile_intel: obj(data.profile_intel),
    onboarded: Boolean(data.onboarded),
  };
}

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_V2_COLUMNS)
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const profile = rowToProfile(userId, data as Record<string, unknown> | null);
    return { status: "ok", profile };
  });

const SaveProfileInput = z
  .object({
    name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    location: z.string().optional(),
    headline: z.string().optional(),
    summary: z.string().optional(),
    target_role: z.string().optional(),
    seniority: z.string().optional(),
    work_mode: z.string().optional(),
    target_locations: z.array(z.string()).optional(),
    salary_expectation: z.record(z.string(), z.unknown()).optional(),
    linkedin_url: z.string().optional(),
    github_url: z.string().optional(),
    portfolio_url: z.string().optional(),
    skills: z.array(z.string()).optional(),
    experience: z.array(z.unknown()).optional(),
    education: z.array(z.unknown()).optional(),
    projects: z.array(z.unknown()).optional(),
    certifications: z.array(z.unknown()).optional(),
    languages: z.array(z.unknown()).optional(),
    achievements: z.array(z.string()).optional(),
    onboarded: z.boolean().optional(),
  })
  .passthrough();

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveProfileInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const update: Record<string, unknown> = { id: userId };
    for (const k of Object.keys(data)) {
      const v = (data as Record<string, unknown>)[k];
      if (v !== undefined) update[k] = v;
    }
    // Keep headline in sync with target_role if not explicitly set.
    if (update.target_role && !update.headline) update.headline = update.target_role;
    const { error } = await supabase.from("profiles").upsert(update as never, { onConflict: "id" });
    if (error) throw new Error(error.message);
    const { data: row } = await supabase
      .from("profiles")
      .select(PROFILE_V2_COLUMNS)
      .eq("id", userId)
      .maybeSingle();
    return { status: "ok", profile: rowToProfile(userId, row as Record<string, unknown> | null) };
  });

/* ---------- GitHub Intelligence ---------- */
const GithubInput = z.object({ url: z.string().min(1).optional() });

export const refreshGithubIntel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GithubInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let url = data.url ?? "";
    if (!url) {
      const { data: p } = await supabase.from("profiles").select("github_url").eq("id", userId).maybeSingle();
      url = (p?.github_url as string) ?? "";
    }
    if (!url) throw new Error("No GitHub URL on profile. Add one first.");
    const { analyzeGithubUrl } = await import("./brain/github-intel.server");
    const intel = await analyzeGithubUrl(url);
    await supabase.from("profiles").update({ github_url: url, github_intel: intel as never }).eq("id", userId);
    return intel;
  });

/* ---------- Jobs ---------- */
const ListInput = z.object({
  limit: z.number().int().min(1).max(1000).optional(),
  status: z.string().optional(),
  task_id: z.string().optional(),
});

export const getJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
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
      remote: r.remote,
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
function parseAppMeta(notes: string | null | undefined): {
  matched?: string[];
  missing?: string[];
  salary_match?: number;
  experience_match?: number;
  location_match?: number;
  application_fields?: Record<string, string>;
} {
  if (!notes) return {};
  try {
    const parsed = JSON.parse(notes);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    /* legacy plain-text note */
  }
  return {};
}

function mapApp(r: Record<string, unknown>) {
  const meta = parseAppMeta(r.notes as string | null);
  return {
    application_id: r.id as string,
    listing_id: r.listing_id as string,
    company: r.company as string,
    job_title: r.job_title as string,
    date_applied: (r.applied_at as string | null) ?? (r.created_at as string),
    status: r.status as string,
    match_score: Number(r.match_score),
    resume_path: r.id ? `application:${r.id as string}:resume` : null,
    cover_letter_path: r.id ? `application:${r.id as string}:cover` : null,
    last_updated: r.updated_at as string,
    notes: typeof r.notes === "string" && !r.notes.startsWith("{") ? r.notes : null,
    matched_skills: meta.matched ?? [],
    missing_skills: meta.missing ?? [],
    salary_match: meta.salary_match,
    experience_match: meta.experience_match,
    location_match: meta.location_match,
    application_fields: meta.application_fields,
  };
}

export const getApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("applications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map(mapApp);
  });

const IdInput = z.object({ id: z.string().min(1) });

export const getApplication = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("applications")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Application not found");
    return {
      ...mapApp(row),
      resume_md: (row.resume_md as string) ?? "",
      cover_letter_md: (row.cover_letter_md as string) ?? "",
    };
  });

export const approveApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { simulateSubmission } = await import("./pipeline.server");
    return simulateSubmission(data.id, context.userId);
  });

export const skipApplicationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { skipApplication } = await import("./pipeline.server");
    return skipApplication(data.id, context.userId);
  });

/* ---------- Activity ---------- */
export const getActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
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

/* ---------- Notifications (no-op) ---------- */
export const getNotifications = createServerFn({ method: "GET" }).handler(
  async () => [] as { notification_id: string; title: string; message: string; created_at: string }[],
);

/* ---------- Dashboard ---------- */
export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [jobsCount, appsCount, interviews, pending, recent] = await Promise.all([
      supabase.from("job_listings").select("id", { count: "exact", head: true }),
      supabase.from("applications").select("id", { count: "exact", head: true }),
      supabase.from("applications").select("id", { count: "exact", head: true }).eq("status", "Interview Scheduled"),
      supabase.from("applications").select("id", { count: "exact", head: true }).eq("status", "Pending Review"),
      supabase.from("applications").select("*").order("created_at", { ascending: false }).limit(8),
    ]);
    return {
      metrics: {
        jobs_discovered: jobsCount.count ?? 0,
        total_applications: appsCount.count ?? 0,
        interviews_scheduled: interviews.count ?? 0,
        pending_review: pending.count ?? 0,
        offers: 0,
      },
      recent_applications: (recent.data ?? []).map(mapApp),
      strategy: {},
      notifications: [],
      activity: [],
      timestamp: new Date().toISOString(),
    };
  });

/* ---------- Brain: profile intelligence ---------- */
export const getProfileIntelligence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (!profile) return null;
    const { analyzeProfile } = await import("./brain/brain.server");
    return analyzeProfile({
      name: (profile.name as string) || "Candidate",
      headline: (profile.headline as string) || undefined,
      summary: (profile.summary as string) || undefined,
      skills: ((profile.skills as string[] | null) ?? []) as string[],
      experience: ((profile.experience as unknown[] | null) ?? []) as unknown[],
      education: ((profile.education as unknown[] | null) ?? []) as unknown[],
      linkedin_url: (profile.linkedin_url as string) || undefined,
      github_url: (profile.github_url as string) || undefined,
      portfolio_url: (profile.portfolio_url as string) || undefined,
      target_roles: profile.headline ? [profile.headline as string] : [],
    });
  });

/* ---------- Brain: career intelligence ---------- */
export const getCareerIntelligence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: apps }, { data: jobs }] = await Promise.all([
      supabase.from("profiles").select("headline, skills").eq("id", userId).maybeSingle(),
      supabase.from("applications").select("status, company, match_score, job_title").limit(100),
      supabase.from("job_listings").select("title, match_score").limit(50),
    ]);
    const totalApps = apps?.length ?? 0;
    const applied = (apps ?? []).filter((a) => a.status === "Applied").length;
    const interview = (apps ?? []).filter((a) =>
      String(a.status).toLowerCase().includes("interview"),
    ).length;
    const companyCounts = new Map<string, number>();
    for (const a of apps ?? []) {
      const c = a.company as string;
      if (c) companyCounts.set(c, (companyCounts.get(c) ?? 0) + 1);
    }
    const topCompanies = [...companyCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([c]) => c);
    const avg =
      (jobs ?? []).reduce((acc, j) => acc + Number(j.match_score ?? 0), 0) /
      Math.max(1, jobs?.length ?? 1);
    const { generateCareerIntelligence } = await import("./brain/brain.server");
    return generateCareerIntelligence({
      candidate_role: (profile?.headline as string) || "Candidate",
      candidate_skills: ((profile?.skills as string[] | null) ?? []) as string[],
      total_applications: totalApps,
      applied_count: applied,
      interview_count: interview,
      top_companies: topCompanies,
      recent_job_titles: (jobs ?? []).slice(0, 10).map((j) => j.title as string),
      avg_match_score: avg,
    });
  });


/* ---------- Artifact (resume / cover letter) ---------- */
const ArtifactInput = z.object({ path: z.string().min(1) });

export const getArtifact = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ArtifactInput.parse(input))
  .handler(async ({ data, context }) => {
    const m = data.path.match(/^application:([^:]+):(resume|cover)$/);
    if (!m) throw new Error("Invalid artifact path");
    const [, appId, kind] = m;
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("applications")
      .select("resume_md, cover_letter_md")
      .eq("id", appId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Application not found");
    return { content: kind === "resume" ? row.resume_md : row.cover_letter_md };
  });

/* ---------- Rendered Resume (RenderCV-style) ---------- */
const RenderResumeInput = z.object({
  application_id: z.string().min(1),
  template: z.enum(["classic", "modern", "compact"]).default("classic"),
});

export const renderApplicationResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RenderResumeInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { renderResumeHtml, analyzeAts } = await import("./rendercv.server");
    const [{ data: app }, { data: profile }] = await Promise.all([
      supabase.from("applications").select("*").eq("id", data.application_id).maybeSingle(),
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    ]);
    if (!app) throw new Error("Application not found");
    const { data: listing } = await supabase
      .from("job_listings")
      .select("tech_stack, description, title")
      .eq("id", app.listing_id as string)
      .maybeSingle();

    const resume_md = (app.resume_md as string) || "";
    const original_md = (profile?.summary as string) ?? "";
    const keywords = ((listing?.tech_stack as string[] | null) ?? []).slice(0, 20);
    const html = renderResumeHtml(resume_md, data.template);
    const ats = analyzeAts(resume_md, keywords, original_md);
    return {
      application_id: data.application_id,
      template: data.template,
      original_md,
      optimized_md: resume_md,
      rendered_html: html,
      ats,
    };
  });

/* ---------- The pipeline trigger ---------- */
const RunSearchInput = z.object({
  role: z.string().min(1),
  location: z.string().min(1),
  experience: z.string().default(""),
  skills: z.string().default(""),
  name: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  company: z.string().default(""),
  max_applications: z.number().int().min(1).max(25).default(8),
  resume_text: z.string().default(""),
});

export const runJobSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RunSearchInput.parse(input))
  .handler(async ({ data, context }) => {
    const { runPipeline } = await import("./pipeline.server");
    const { supabase, userId, claims } = context;
    const task_id = `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    // Persist latest profile snapshot for the user
    const skillList = data.skills.split(",").map((s) => s.trim()).filter(Boolean);
    const fallbackEmail = (claims?.email as string | undefined) ?? "";
    await supabase.from("profiles").upsert(
      {
        id: userId,
        name: data.name || "Candidate",
        email: data.email || fallbackEmail,
        phone: data.phone,
        location: data.location,
        headline: data.role,
        summary: data.resume_text.slice(0, 1000),
        skills: skillList,
      },
      { onConflict: "id" },
    );

    const result = await runPipeline({
      task_id,
      user_id: userId,
      role: data.role,
      location: data.location,
      experience: data.experience,
      skills: skillList,
      candidate: {
        name: data.name || "Candidate",
        email: data.email || fallbackEmail || "candidate@example.com",
        phone: data.phone,
        summary: data.resume_text.slice(0, 1000),
      },
      max_applications: data.max_applications,
    });

    return {
      status: "ok",
      task_id: result.task_id,
      mode: "review",
      message: "Pipeline complete — packages awaiting user approval",
      summary: result.summary,
      per_source: result.per_source,
      matches: result.matches.map((m) => ({
        application_id: m.application_id,
        listing_id: m.listing_id,
        title: m.title,
        company: m.company,
        location: m.location,
        source: m.source,
        url: m.url,
        match_score: m.match_score,
        matched_skills: m.matched_skills,
        missing_skills: m.missing_skills,
        salary_match: m.salary_match,
        experience_match: m.experience_match,
        location_match: m.location_match,
        resume_path: `application:${m.application_id}:resume`,
        cover_letter_path: `application:${m.application_id}:cover`,
        submission_status: "pending_review",
        submitted: false,
      })),
      skipped: [],
    };
  });
