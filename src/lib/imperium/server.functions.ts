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
    skills: ["RemoteOK", "Remotive", "Arbeitnow", "Adzuna", "Jooble", "LinkedIn", "Local scoring"],
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

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

function rowToProfile(userId: string, data: Record<string, unknown> | null) {
  if (!data) return null;
  const arr = <T = JsonValue>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const obj = (v: unknown): JsonValue =>
    v && typeof v === "object" && !Array.isArray(v)
      ? (JSON.parse(JSON.stringify(v)) as JsonValue)
      : ({} as JsonValue);
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

/**
 * getAgentContext — returns the EXACT structured payload every Imperium
 * agent receives before generating a resume, cover letter, or match.
 * Backed by Profile (single source of truth). Used by /profile-preview so
 * the user can see byte-for-byte what the agents see.
 */
export const getAgentContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("profiles")
      .select(PROFILE_V2_COLUMNS)
      .eq("id", userId)
      .maybeSingle();
    const profile = rowToProfile(userId, data as Record<string, unknown> | null);
    const { buildAgentContext } = await import("./profile/agent-context");
    const { computeCompleteness } = await import("./profile/completeness");
    const ctx = buildAgentContext(profile as never);
    const completeness = computeCompleteness(profile as never);
    return {
      profile,
      completeness,
      agent_context: {
        personal: ctx.personal,
        career: ctx.career,
        skills: ctx.skills,
        projects: ctx.projects,
        experience: ctx.experience,
        education: ctx.education,
        certifications: ctx.certifications,
        languages: ctx.languages,
        achievements: ctx.achievements,
        is_fresher: ctx.is_fresher,
        vocabulary_size: ctx.vocabulary.size,
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

/* ---------- Profile Import (resume text / LinkedIn) ---------- */
const ImportTextInput = z.object({ text: z.string().min(20).max(200_000) });

export const importProfileFromText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ImportTextInput.parse(i))
  .handler(async ({ data }) => {
    const { extractProfileFromText } = await import("./brain/profile-import.server");
    return extractProfileFromText(data.text);
  });

const ImportLinkedinInput = z.object({ url: z.string().min(8).max(500) });

export const importProfileFromLinkedin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ImportLinkedinInput.parse(i))
  .handler(async ({ data }) => {
    const { extractProfileFromLinkedinUrl } = await import("./brain/profile-import.server");
    return extractProfileFromLinkedinUrl(data.url);
  });

const ImportPdfInput = z.object({ base64: z.string().min(100).max(12_000_000) });

export const importProfileFromPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ImportPdfInput.parse(i))
  .handler(async ({ data }) => {
    const { extractProfileFromPdfBase64 } = await import("./brain/profile-import.server");
    return extractProfileFromPdfBase64(data.base64);
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
    source: (r.source as string) ?? "",
    url: (r.url as string) ?? "",
    date_applied: (r.applied_at as string | null) ?? (r.created_at as string),
    status: r.status as string,
    match_score: Number(r.match_score),
    resume_path: r.id ? `application:${r.id as string}:resume` : null,
    cover_letter_path: r.id ? `application:${r.id as string}:cover` : null,
    resume_version: (r.resume_version as string) ?? "",
    cover_letter_version: (r.cover_letter_version as string) ?? "",
    last_updated: r.updated_at as string,
    notes: typeof r.notes === "string" && !r.notes.startsWith("{") ? r.notes : null,
    interview_notes: (r.interview_notes as string) ?? "",
    recruiter_notes: (r.recruiter_notes as string) ?? "",
    next_action: (r.next_action as string) ?? "",
    next_action_at: (r.next_action_at as string | null) ?? null,
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
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("applications")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Application not found");
    const [{ data: listing }, { data: profileRow }] = await Promise.all([
      supabase.from("job_listings").select("*").eq("id", row.listing_id as string).maybeSingle(),
      supabase.from("profiles").select(PROFILE_V2_COLUMNS).eq("id", userId).maybeSingle(),
    ]);
    const profile = rowToProfile(userId, profileRow as Record<string, unknown> | null);
    const { buildAgentContext } = await import("./profile/agent-context");
    const { buildResumeFromProfile, buildCoverFromProfile } = await import("./profile/generators");
    const ctx = buildAgentContext(profile as never);
    const job = {
      title: (listing?.title as string) || (row.job_title as string) || "Target Role",
      company: (listing?.company as string) || (row.company as string) || "Target Company",
      description: (listing?.description as string) || "",
      tech_stack: ((listing?.tech_stack as string[] | null) ?? []) as string[],
      location: (listing?.location as string) || "",
    };
    return {
      ...mapApp(row),
      resume_md: buildResumeFromProfile(ctx, job),
      cover_letter_md: buildCoverFromProfile(ctx, job),
    };
  });

export const approveApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { simulateSubmission } = await import("./pipeline.server");
    return simulateSubmission(data.id, context.userId, context.supabase);
  });

export const skipApplicationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { skipApplication } = await import("./pipeline.server");
    return skipApplication(data.id, context.userId, context.supabase);
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
      supabase.from("applications").select("id", { count: "exact", head: true }).eq("status", "Interview"),
      supabase.from("applications").select("id", { count: "exact", head: true }).eq("status", "Preparing"),
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
    const profileRecord = profile as Record<string, unknown> | null;
    const skills = ((profileRecord?.skills as string[] | null) ?? []) as string[];
    return {
      market_insights: [
        `${jobs?.length ?? 0} saved/discovered jobs available for local comparison.`,
        `Average match score is ${Math.round(avg * 100)}% across recent roles.`,
        topCompanies.length ? `Most frequent companies: ${topCompanies.join(", ")}.` : "Run a job search to collect company signal.",
      ],
      skill_recommendations: skills.slice(0, 8),
      learning_recommendations: skills.length ? skills.slice(0, 4).map((s) => `Prepare one measurable story for ${s}.`) : ["Add skills in Settings to improve local matching."],
      application_strategy: `Local strategy: ${totalApps} applications tracked, ${applied} applied, ${interview} interview-stage. Prioritize roles above 60% match and review every generated package before applying.`,
      growth_opportunities: (jobs ?? []).slice(0, 5).map((j) => `Target similar roles to ${(j.title as string) || "recent match"}`),
    };
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
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("applications")
      .select("*")
      .eq("id", appId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Application not found");
    const [{ data: listing }, { data: profileRow }] = await Promise.all([
      supabase.from("job_listings").select("*").eq("id", row.listing_id as string).maybeSingle(),
      supabase.from("profiles").select(PROFILE_V2_COLUMNS).eq("id", userId).maybeSingle(),
    ]);
    const { buildAgentContext } = await import("./profile/agent-context");
    const { buildResumeFromProfile, buildCoverFromProfile } = await import("./profile/generators");
    const ctx = buildAgentContext(rowToProfile(userId, profileRow as Record<string, unknown> | null) as never);
    const job = {
      title: (listing?.title as string) || (row.job_title as string) || "Target Role",
      company: (listing?.company as string) || (row.company as string) || "Target Company",
      description: (listing?.description as string) || "",
      tech_stack: ((listing?.tech_stack as string[] | null) ?? []) as string[],
      location: (listing?.location as string) || "",
    };
    return { content: kind === "resume" ? buildResumeFromProfile(ctx, job) : buildCoverFromProfile(ctx, job) };
  });

/* ---------- Rendered Resume (RenderCV-style) ---------- */
const RenderResumeInput = z.object({
  application_id: z.string().min(1),
  template: z.enum(["jake-ats", "classic", "modern", "compact"]).default("jake-ats"),
});

export const renderApplicationResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RenderResumeInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { renderResumeHtml, analyzeAts } = await import("./rendercv.server");
    const { buildAgentContext } = await import("./profile/agent-context");
    const { buildResumeFromProfile } = await import("./profile/generators");
    const [{ data: app }, { data: profile }] = await Promise.all([
      supabase.from("applications").select("*").eq("id", data.application_id).maybeSingle(),
      supabase.from("profiles").select(PROFILE_V2_COLUMNS).eq("id", userId).maybeSingle(),
    ]);
    if (!app) throw new Error("Application not found");
    const { data: listing } = await supabase
      .from("job_listings")
      .select("tech_stack, description, title, company, location")
      .eq("id", app.listing_id as string)
      .maybeSingle();

    const profileDto = rowToProfile(userId, profile as Record<string, unknown> | null);
    const ctx = buildAgentContext(profileDto as never);
    const resume_md = buildResumeFromProfile(ctx, {
      title: (listing?.title as string) || (app.job_title as string) || "Target Role",
      company: (listing?.company as string) || (app.company as string) || "Target Company",
      description: (listing?.description as string) || "",
      tech_stack: ((listing?.tech_stack as string[] | null) ?? []) as string[],
      location: (listing?.location as string) || "",
    });
    const original_md = (profileDto?.summary as string) ?? "";
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

/* ---------- Brain: optimize master resume against a job ---------- */
const OptimizeMasterInput = z.object({
  resume_md: z.string().min(1),
  job_description: z.string().min(1),
  job_title: z.string().default("Target Role"),
  company: z.string().default("Target Company"),
  template: z.enum(["jake-ats", "classic", "modern", "compact"]).default("jake-ats"),
});

export const optimizeMasterResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OptimizeMasterInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profileRow } = await supabase
      .from("profiles")
      .select(PROFILE_V2_COLUMNS)
      .eq("id", userId)
      .maybeSingle();
    const profile = rowToProfile(userId, profileRow as Record<string, unknown> | null);
    const { extractKeywords } = await import("./resume-render");
    const { buildAgentContext } = await import("./profile/agent-context");
    const { buildResumeFromProfile } = await import("./profile/generators");
    const { validateAgainstProfile, stripHallucinations } = await import("./profile/agent-context");

    const jobKeywords = extractKeywords(data.job_description, 20);
    const ctx = buildAgentContext(profile as never);
    // Profile-first generation. Tailored to the job's title/company; never
    // appends invented keyword lists.
    const optimized = buildResumeFromProfile(ctx, {
      title: data.job_title,
      company: data.company,
      description: data.job_description,
      tech_stack: jobKeywords,
    });
    // Validate against profile vocabulary; strip any hallucinated tech terms.
    const report = validateAgainstProfile(optimized, ctx);
    const safe = report.ok ? optimized : stripHallucinations(optimized, ctx);

    const candSkills = ctx.skills;
    const matched = candSkills.filter((s) =>
      data.job_description.toLowerCase().includes(s.toLowerCase()),
    );
    const missing = jobKeywords.filter(
      (k) => !candSkills.some((s) => s.toLowerCase() === k.toLowerCase()),
    );
    const before = jobKeywords.length
      ? Math.round((jobKeywords.filter((k) => data.resume_md.toLowerCase().includes(k.toLowerCase())).length / jobKeywords.length) * 100)
      : 70;
    const after = jobKeywords.length
      ? Math.round((jobKeywords.filter((k) => safe.toLowerCase().includes(k.toLowerCase())).length / jobKeywords.length) * 100)
      : before;
    return {
      optimized_md: safe,
      ats_score_before: before,
      ats_score_after: after,
      improvements: [
        `Rebuilt resume from profile (${ctx.projects.length} projects, ${ctx.skills.length} skills, ${ctx.education.length} education entries).`,
        matched.length ? `Aligned ${matched.length} profile skills with the job description.` : "No direct skill overlap detected — review profile skills.",
        report.ok ? "Validation passed — no hallucinated technologies." : `Stripped ${report.hallucinated.length} hallucinated term(s) the profile does not support.`,
      ],
      added_keywords: matched,
      reasoning: "Profile-first generation. Job description only customizes ordering and the targeting line — no invented experience or tech.",
    };
  });

/* ---------- Brain: per-listing intelligence ---------- */
export const analyzeJobListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [{ data: listing }, { data: profile }] = await Promise.all([
      supabase.from("job_listings").select("*").eq("id", data.id).maybeSingle(),
      supabase.from("profiles").select("headline, skills, experience, target_role").eq("id", userId).maybeSingle(),
    ]);
    if (!listing) throw new Error("Listing not found");
    const profileRecord = profile as Record<string, unknown> | null;
    const skills = ((profileRecord?.skills as string[] | null) ?? []) as string[];
    const expCount = ((profileRecord?.experience as unknown[] | null) ?? []).length;
    const techStack = ((listing.tech_stack as string[] | null) ?? []) as string[];
    const jobText = `${listing.title ?? ""} ${listing.description ?? ""} ${techStack.join(" ")}`.toLowerCase();
    const matched = skills.filter((s) => jobText.includes(s.toLowerCase()));
    const missing = techStack.filter((k) => !skills.some((s) => s.toLowerCase() === k.toLowerCase())).slice(0, 8);
    const matchScore = Number(listing.match_score ?? (skills.length ? matched.length / skills.length : 0.5));
    return {
      match_score: matchScore,
      confidence: 0.82,
      required_match: skills.length ? matched.length / skills.length : matchScore,
      preferred_match: matchScore,
      matched_skills: matched.slice(0, 8),
      missing_skills: missing,
      strength_alignment: matched.slice(0, 8),
      risk: matchScore >= 0.65 ? "low" : matchScore >= 0.4 ? "medium" : "high",
      difficulty: expCount > 2 ? "moderate" : "standard",
      interview_potential: Math.max(0.2, Math.min(0.9, matchScore + 0.1)),
      recommendation: matchScore >= 0.65 ? "apply" : matchScore >= 0.4 ? "consider" : "skip",
      reasoning: "Local deterministic analysis from saved job text, tech stack, and profile skills.",
    };
  });

/* ---------- Brain: application readiness ---------- */
export const evaluateApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: app } = await supabase
      .from("applications")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!app) throw new Error("Application not found");
    const { data: listing } = await supabase
      .from("job_listings")
      .select("*")
      .eq("id", app.listing_id as string)
      .maybeSingle();
    const { data: profile } = await supabase
      .from("profiles")
      .select(PROFILE_V2_COLUMNS)
      .eq("id", userId)
      .maybeSingle();
    const { analyzeAts } = await import("./rendercv.server");
    const { buildAgentContext } = await import("./profile/agent-context");
    const { buildResumeFromProfile } = await import("./profile/generators");
    const profileRecord = profile as Record<string, unknown> | null;

    const skills = ((profileRecord?.skills as string[] | null) ?? []) as string[];
    const expCount = ((profileRecord?.experience as unknown[] | null) ?? []).length;
    const jobKeywords = ((listing?.tech_stack as string[] | null) ?? []) as string[];
    const resumeText = buildResumeFromProfile(buildAgentContext(rowToProfile(userId, profileRecord) as never), {
      title: (listing?.title as string) || (app.job_title as string) || "Target Role",
      company: (listing?.company as string) || (app.company as string) || "Target Company",
      description: (listing?.description as string) || "",
      tech_stack: jobKeywords,
      location: (listing?.location as string) || "",
    });
    const matchedSkills = skills.filter((skill) =>
      `${listing?.description ?? ""} ${jobKeywords.join(" ")}`.toLowerCase().includes(skill.toLowerCase()),
    );
    const matchScore = Number(app.match_score ?? 0);
    const job_score = {
      match_score: matchScore,
      confidence: 0.82,
      recommendation: matchScore >= 0.65 ? "apply" : matchScore >= 0.4 ? "consider" : "skip",
      required_match: skills.length ? matchedSkills.length / skills.length : matchScore,
      preferred_match: matchScore,
      matched_skills: matchedSkills.slice(0, 8),
      missing_skills: jobKeywords.filter((k) => !skills.some((s) => s.toLowerCase() === k.toLowerCase())).slice(0, 8),
      strength_alignment: matchedSkills.slice(0, 8),
      risk: matchScore >= 0.65 ? "low" : matchScore >= 0.4 ? "medium" : "high",
      difficulty: expCount > 2 ? "moderate" : "standard",
      interview_potential: Math.max(0.2, Math.min(0.9, matchScore + 0.1)),
      reasoning: "Local deterministic scoring based on title, skills, location, and ATS keyword coverage.",
    };
    const ats = analyzeAts(
      resumeText,
      jobKeywords.slice(0, 20),
    );
    const readinessScore = Math.round(matchScore * 55 + ats.score * 0.45);
    const readiness = {
      readiness_score: readinessScore,
      success_probability: Math.max(0.2, Math.min(0.9, readinessScore / 100)),
      final_recommendation: readinessScore >= 65 ? "submit" : readinessScore >= 45 ? "revise" : "skip",
      reasoning: "Computed locally from match score and ATS keyword coverage. No AI provider is required.",
      risks: [
        ...(job_score.missing_skills.length ? [`Missing keywords: ${job_score.missing_skills.slice(0, 4).join(", ")}`] : []),
        ...(ats.score < 50 ? ["Low ATS keyword coverage"] : []),
      ],
      recommended_improvements: ats.missing_keywords.slice(0, 5).map((k) => `Add evidence for ${k}`),
    };
    return { job_score, ats, readiness };
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

function mergeStringList(primary: string[] = [], secondary: string[] = []): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of [...primary, ...secondary]) {
    const text = String(value ?? "").trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function appendIfMissing<T>(primary: T[] = [], secondary: T[] = [], keyOf: (item: T) => string): T[] {
  const seen = new Set(primary.map((item) => keyOf(item).toLowerCase()).filter(Boolean));
  const out = [...primary];
  for (const item of secondary) {
    const key = keyOf(item).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function meaningfulResumeText(text: string): boolean {
  const t = text.trim();
  return t.length >= 120 && !/^\[resume file uploaded:/i.test(t);
}

function isBadSummary(value?: string): boolean {
  const t = (value ?? "").trim();
  return !t || /^\[resume file uploaded:/i.test(t) || /^role alignment for .+profile-backed strengths in/i.test(t);
}

export const runJobSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RunSearchInput.parse(input))
  .handler(async ({ data, context }) => {
    const { runPipeline } = await import("./pipeline.server");
    const { supabase, userId, claims } = context;
    const task_id = `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    // PROFILE IS THE SOURCE OF TRUTH.
    // Read the saved profile first. Only fill in *missing* fields from the
    // search form — never overwrite existing rich profile data with a thin
    // form submission.
    const { data: existing } = await supabase
      .from("profiles")
      .select(PROFILE_V2_COLUMNS)
      .eq("id", userId)
      .maybeSingle();
    const existingProfile = rowToProfile(userId, existing as Record<string, unknown> | null);
    const fallbackEmail = (claims?.email as string | undefined) ?? "";
    const formSkills = data.skills.split(",").map((s) => s.trim()).filter(Boolean);
    const resumePatch = meaningfulResumeText(data.resume_text)
      ? (await (async () => {
          try {
            const { extractProfileFromText } = await import("./brain/profile-import.server");
            return (await extractProfileFromText(data.resume_text)).patch as Record<string, unknown>;
          } catch (error) {
            await supabase.from("activity_log").insert({
              user_id: userId,
              task_id,
              agent: "job_agent",
              action: "resume_import",
              status: "failed",
              detail: error instanceof Error ? error.message : String(error),
            });
            return {} as Record<string, unknown>;
          }
        })())
      : ({} as Record<string, unknown>);
    const importedSkills = Array.isArray(resumePatch.skills) ? (resumePatch.skills as string[]) : [];
    const mergedSkills = mergeStringList(
      existingProfile?.skills?.length ? existingProfile.skills : [],
      mergeStringList(formSkills, importedSkills),
    );

    const merged = {
      id: userId,
      name: existingProfile?.name || (resumePatch.name as string) || data.name || "Candidate",
      email: existingProfile?.email || (resumePatch.email as string) || data.email || fallbackEmail,
      phone: existingProfile?.phone || (resumePatch.phone as string) || data.phone || "",
      location: existingProfile?.location || data.location,
      headline: existingProfile?.headline || (resumePatch.headline as string) || data.role,
      summary: !isBadSummary(existingProfile?.summary) ? existingProfile?.summary : (resumePatch.summary as string) || "",
      target_role: existingProfile?.target_role || (resumePatch.target_role as string) || data.role,
      skills: mergedSkills,
      experience: appendIfMissing(existingProfile?.experience ?? [], (resumePatch.experience as never[]) ?? [], (e) => `${(e as { company?: string }).company ?? ""}:${(e as { title?: string }).title ?? ""}`),
      education: appendIfMissing(existingProfile?.education ?? [], (resumePatch.education as never[]) ?? [], (e) => `${(e as { school?: string }).school ?? ""}:${(e as { degree?: string }).degree ?? ""}`),
      projects: appendIfMissing(existingProfile?.projects ?? [], (resumePatch.projects as never[]) ?? [], (p) => (p as { name?: string }).name ?? ""),
      certifications: appendIfMissing(existingProfile?.certifications ?? [], (resumePatch.certifications as never[]) ?? [], (c) => (c as { name?: string }).name ?? ""),
      languages: appendIfMissing(existingProfile?.languages ?? [], (resumePatch.languages as never[]) ?? [], (l) => (l as { name?: string }).name ?? ""),
      achievements: mergeStringList(existingProfile?.achievements ?? [], (resumePatch.achievements as string[]) ?? []),
      linkedin_url: existingProfile?.linkedin_url || (resumePatch.linkedin_url as string) || "",
      github_url: existingProfile?.github_url || (resumePatch.github_url as string) || "",
      portfolio_url: existingProfile?.portfolio_url || (resumePatch.portfolio_url as string) || "",
    };

    // Persist non-destructively (only the fields we *do* know).
    await supabase.from("profiles").upsert(
      {
        id: userId,
        name: merged.name,
        email: merged.email,
        phone: merged.phone,
        location: merged.location,
        headline: merged.headline,
        summary: merged.summary,
        target_role: merged.target_role,
        skills: merged.skills,
        experience: merged.experience,
        education: merged.education,
        projects: merged.projects,
        certifications: merged.certifications,
        languages: merged.languages,
        achievements: merged.achievements,
        linkedin_url: merged.linkedin_url,
        github_url: merged.github_url,
        portfolio_url: merged.portfolio_url,
      },
      { onConflict: "id" },
    );

    const result = await runPipeline({
      db: supabase,
      task_id,
      user_id: userId,
      role: data.role,
      location: data.location,
      experience: data.experience,
      skills: merged.skills,
      profile: merged as never,
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

/* ---------- Application status updates + timeline ---------- */
const UpdateStatusInput = z.object({
  id: z.string().min(1),
  status: z.enum([
    "Saved",
    "Preparing",
    "Applied",
    "ManualApplyPending", // B9 — agent could not finish; needs human action
    "Assessment",
    "Interview",
    "Offer",
    "Rejected",
    "Withdrawn",
  ]),
  note: z.string().max(2000).optional(),
});

export const updateApplicationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateStatusInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: app, error: readErr } = await supabase
      .from("applications")
      .select("status")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!app) throw new Error("Application not found");
    const prev = (app.status as string) || "";
    const patch: Record<string, unknown> = {
      status: data.status,
      updated_at: new Date().toISOString(),
    };
    if (data.status === "Applied") patch.applied_at = new Date().toISOString();
    const { error: updErr } = await supabase
      .from("applications")
      .update(patch as never)
      .eq("id", data.id);
    if (updErr) throw new Error(updErr.message);
    await supabase.from("application_timeline").insert({
      user_id: userId,
      application_id: data.id,
      event_type: "status_change",
      from_status: prev,
      to_status: data.status,
      note: data.note ?? "",
    });
    return { ok: true };
  });

const UpdateAppFieldsInput = z.object({
  id: z.string().min(1),
  interview_notes: z.string().max(20000).optional(),
  recruiter_notes: z.string().max(20000).optional(),
  next_action: z.string().max(500).optional(),
  next_action_at: z.string().nullable().optional(),
  resume_version: z.string().max(120).optional(),
  cover_letter_version: z.string().max(120).optional(),
});

export const updateApplicationFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateAppFieldsInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of [
      "interview_notes",
      "recruiter_notes",
      "next_action",
      "next_action_at",
      "resume_version",
      "cover_letter_version",
    ] as const) {
      const v = (data as Record<string, unknown>)[k];
      if (v !== undefined) patch[k] = v;
    }
    const { error } = await supabase.from("applications").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };

  });

/* ---------- B8: attach local-agent run id to an application ---------- */
const AttachAgentRunInput = z.object({
  application_id: z.string().min(1),
  local_agent_job_id: z.string().min(1).max(120),
});

/**
 * Persists the local Python agent's run id inside `applications.notes` JSON
 * so the HMAC callback at /api/public/agent-callback can locate the right
 * application when the agent reports a terminal state.
 *
 * Note: Phase 1 stores this in the existing `notes` JSON to avoid a schema
 * migration. A dedicated column can be added later without UI changes.
 */
export const attachLocalAgentRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AttachAgentRunInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error: readErr } = await supabase
      .from("applications")
      .select("notes")
      .eq("id", data.application_id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!row) throw new Error("Application not found");
    let meta: Record<string, unknown> = {};
    try {
      meta = JSON.parse((row.notes as string) || "{}") as Record<string, unknown>;
    } catch {
      meta = {};
    }
    meta.local_agent_job_id = data.local_agent_job_id;
    const { error: updErr } = await supabase
      .from("applications")
      .update({
        notes: JSON.stringify(meta),
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", data.application_id);
    if (updErr) throw new Error(updErr.message);
    return { ok: true };
  });


export const getApplicationTimeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("application_timeline")
      .select("*")
      .eq("application_id", data.id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id as string,
      application_id: r.application_id as string,
      event_type: r.event_type as string,
      from_status: (r.from_status as string) ?? "",
      to_status: (r.to_status as string) ?? "",
      note: (r.note as string) ?? "",
      created_at: r.created_at as string,
    }));
  });

/* ---------- Saved jobs (curated list — survives searches) ---------- */
const SaveJobInput = z.object({
  source: z.string().min(1),
  external_id: z.string().min(1),
  url: z.string().default(""),
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().default(""),
  remote: z.boolean().default(false),
  description: z.string().default(""),
  tech_stack: z.array(z.string()).default([]),
  match_score: z.number().min(0).max(1).default(0),
  bookmarked: z.boolean().default(false),
});

export const saveJobListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveJobInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("job_listings")
      .select("id")
      .eq("user_id", userId)
      .eq("source", data.source)
      .eq("external_id", data.external_id)
      .maybeSingle();
    if (existing?.id) {
      await supabase
        .from("job_listings")
        .update({ saved: true, bookmarked: data.bookmarked })
        .eq("id", existing.id);
      return { ok: true, id: existing.id as string };
    }
    const { data: inserted, error } = await supabase
      .from("job_listings")
      .insert({
        ...data,
        user_id: userId,
        saved: true,
        status: "saved",
      })
      .select("id")
      .single();
    if (error || !inserted) throw new Error(error?.message ?? "Failed to save job");
    return { ok: true, id: inserted.id as string };
  });

export const unsaveJobListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("job_listings")
      .update({ saved: false, bookmarked: false })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getSavedJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("job_listings")
      .select("*")
      .or("saved.eq.true,bookmarked.eq.true")
      .order("discovered_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      listing_id: r.id as string,
      source: r.source as string,
      url: (r.url as string) ?? "",
      title: r.title as string,
      company: r.company as string,
      location: (r.location as string) ?? "",
      remote: Boolean(r.remote),
      description: (r.description as string) ?? "",
      technology_stack: (r.tech_stack as string[] | null) ?? [],
      match_score: Number(r.match_score ?? 0),
      saved: Boolean(r.saved),
      bookmarked: Boolean(r.bookmarked),
      discovered_at: r.discovered_at as string,
    }));
  });

/* ---------- Interviews ---------- */
const InterviewInput = z.object({
  id: z.string().optional(),
  application_id: z.string().nullable().optional(),
  company: z.string().min(1).max(200),
  position: z.string().max(200).default(""),
  stage: z.enum(["Screening", "Technical", "Managerial", "Final Round", "Offer", "Rejected"]).default("Screening"),
  interview_at: z.string().nullable().optional(),
  location: z.string().max(200).default(""),
  recruiter: z.string().max(200).default(""),
  notes: z.string().max(20000).default(""),
  feedback: z.string().max(20000).default(""),
  outcome: z.string().max(500).default(""),
});

export const upsertInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InterviewInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload: Record<string, unknown> = {
      user_id: userId,
      application_id: data.application_id ?? null,
      company: data.company,
      position: data.position,
      stage: data.stage,
      interview_at: data.interview_at ?? null,
      location: data.location,
      recruiter: data.recruiter,
      notes: data.notes,
      feedback: data.feedback,
      outcome: data.outcome,
    };
    if (data.id) {
      const { error } = await supabase.from("interviews").update(payload as never).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: inserted, error } = await supabase
      .from("interviews")
      .insert(payload as never)
      .select("id")
      .single();
    if (error || !inserted) throw new Error(error?.message ?? "Failed to create interview");
    return { ok: true, id: inserted.id as string };
  });

export const getInterviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("interviews")
      .select("*")
      .order("interview_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id as string,
      application_id: (r.application_id as string | null) ?? null,
      company: r.company as string,
      position: (r.position as string) ?? "",
      stage: (r.stage as string) ?? "Screening",
      interview_at: (r.interview_at as string | null) ?? null,
      location: (r.location as string) ?? "",
      recruiter: (r.recruiter as string) ?? "",
      notes: (r.notes as string) ?? "",
      feedback: (r.feedback as string) ?? "",
      outcome: (r.outcome as string) ?? "",
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
    }));
  });

export const deleteInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("interviews").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------- Skill Gap Analysis ---------- */
export const getSkillGap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: jobs }] = await Promise.all([
      supabase
        .from("profiles")
        .select("target_role, headline, skills")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("job_listings")
        .select("title, tech_stack")
        .order("discovered_at", { ascending: false })
        .limit(60),
    ]);
    const profileRecord = profile as Record<string, unknown> | null;
    const candidate_skills = ((profileRecord?.skills as string[] | null) ?? []) as string[];
    const target_role =
      (profileRecord?.target_role as string) || (profileRecord?.headline as string) || "Candidate";
    const recent_job_titles = (jobs ?? [])
      .map((j) => j.title as string)
      .filter(Boolean)
      .slice(0, 20);
    const recent_job_skills = (jobs ?? []).flatMap(
      (j) => ((j.tech_stack as string[] | null) ?? []) as string[],
    );
    const marketCounts = new Map<string, number>();
    for (const skill of recent_job_skills) {
      const key = String(skill).trim();
      if (!key) continue;
      marketCounts.set(key, (marketCounts.get(key) ?? 0) + 1);
    }
    const candidateSet = new Set(candidate_skills.map((s) => s.toLowerCase()));
    const missing = [...marketCounts.entries()]
      .filter(([skill]) => !candidateSet.has(skill.toLowerCase()))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([skill, count]) => ({
        skill,
        importance: count >= 4 ? "critical" : count >= 2 ? "important" : "nice_to_have",
        rationale: `Appears in ${count} recent job listing${count > 1 ? "s" : ""}.`,
        resource_hint: `Build a small portfolio task using ${skill}.`,
      }));
    const matched = candidate_skills.filter((s) => marketCounts.has(s));
    return {
      target_role,
      matched_skills: matched,
      missing_skills: missing,
      roadmap_30_60_90: {
        thirty: missing.slice(0, 3).map((m) => `Refresh fundamentals for ${m.skill}.`),
        sixty: missing.slice(3, 6).map((m) => `Build a project showing ${m.skill}.`),
        ninety: missing.slice(6, 9).map((m) => `Add ${m.skill} proof to resume and applications.`),
      },
      summary: recent_job_titles.length
        ? `Local analysis compared your profile against ${recent_job_titles.length} recent job titles and ${recent_job_skills.length} market skill signals.`
        : "Run a job search to gather local market signals for skill-gap analysis.",
      model: "local-deterministic",
    };
  });

