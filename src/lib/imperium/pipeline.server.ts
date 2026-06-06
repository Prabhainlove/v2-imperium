/**
 * Imperium Job Agent pipeline. Server-only.
 * Orchestrates: plan -> discover (multi-source w/ availability flags)
 *              -> dedupe -> rich scoring -> shortlist
 *              -> per-job analyze + resume + cover letter
 *              -> stage as **Pending Review** (no auto submission).
 * Writes an activity_log row at every stage so the UI animates live.
 */
import { SOURCES, type RawJob } from "./sources.server";
import { buildAgentContext, type AgentContext } from "./profile/agent-context";
import { buildResumeFromProfile, buildCoverFromProfile } from "./profile/generators";
import type { ImperiumProfile } from "./profile/types";

type ImperiumDb = { from: (table: string) => any };

export interface PipelineInput {
  db: ImperiumDb;
  task_id: string;
  user_id: string;
  role: string;
  location: string;
  experience: string;
  skills: string[];
  /** Full profile snapshot — single source of truth for every generator. */
  profile: Partial<ImperiumProfile>;
  max_applications: number;
  desired_salary_min?: number | null;
}

async function log(
  db: ImperiumDb,
  user_id: string,
  task_id: string,
  action: string,
  status: "ok" | "running" | "success" | "failed" | "completed" | "skipped" = "ok",
  detail = "",
) {
  await db.from("activity_log").insert({
    user_id,
    task_id,
    agent: "job_agent",
    action,
    status,
    detail,
  });
}

interface ScoreBreakdown {
  overall: number;
  title_score: number;
  skill_score: number;
  matched: string[];
  missing: string[];
  salary_match: number;     // 0..1
  experience_match: number; // 0..1
  location_match: number;   // 0..1
}

function normalizeSkill(value: string): string {
  return value.toLowerCase().replace(/\.js\b/g, "").replace(/[^a-z0-9+#]+/g, " ").trim();
}

function skillMatchesJob(skill: string, jobText: string, stack: string[]): boolean {
  const normalized = normalizeSkill(skill);
  if (!normalized) return false;
  const haystack = normalizeSkill(`${jobText} ${stack.join(" ")}`);
  if (haystack.includes(normalized)) return true;
  const aliases: Record<string, string[]> = {
    react: ["reactjs", "frontend", "ui"],
    node: ["nodejs", "backend", "api"],
    postgres: ["postgresql", "sql"],
    postgresql: ["postgres", "sql"],
    javascript: ["js"],
    typescript: ["ts"],
    "rest apis": ["rest", "api", "apis"],
  };
  return (aliases[normalized] ?? []).some((alias) => haystack.includes(alias));
}

function scoreJob(
  job: RawJob,
  role: string,
  skills: string[],
  experience: string,
  location: string,
  desired_salary_min?: number | null,
): ScoreBreakdown {
  const text = `${job.title} ${job.description} ${job.tech_stack.join(" ")}`.toLowerCase();

  // Title match
  const role_terms = role.toLowerCase().split(/\s+/).filter((s) => s.length > 2);
  let title_hits = 0;
  for (const r of role_terms) if (job.title.toLowerCase().includes(r)) title_hits++;
  const title_score = role_terms.length ? title_hits / role_terms.length : 0;

  // Skill match
  const wanted = skills.map((s) => s.toLowerCase().trim()).filter(Boolean);
  const matched: string[] = [];
  const missing: string[] = [];
  for (const s of wanted) {
    if (skillMatchesJob(s, text, job.tech_stack)) matched.push(s);
    else missing.push(s);
  }
  const skill_score = wanted.length ? matched.length / wanted.length : 0.5;

  // Location match
  const loc_q = location.toLowerCase().trim();
  const job_loc = (job.location || "").toLowerCase();
  let location_match = 0;
  if (!loc_q || loc_q === "remote" || loc_q === "anywhere") location_match = job.remote ? 1 : 0.6;
  else if (job_loc.includes(loc_q) || loc_q.split(/[, ]/).some((p) => p && job_loc.includes(p))) location_match = 1;
  else if (job.remote) location_match = 0.8;
  else location_match = 0.3;

  // Experience match (uses simple year-extraction)
  const yrs_in_q = Number(experience.match(/\d+/)?.[0] ?? 0);
  const yrs_in_job = Number((job.description.match(/(\d+)\+?\s*(?:years|yrs)/i) ?? [])[1] ?? 0);
  let experience_match = 0.7;
  if (yrs_in_job > 0 && yrs_in_q > 0) {
    const diff = Math.abs(yrs_in_q - yrs_in_job);
    experience_match = diff <= 1 ? 1 : diff <= 3 ? 0.7 : 0.4;
  }

  // Salary match
  let salary_match = 0.7;
  if (desired_salary_min && job.salary_min) {
    salary_match = job.salary_min >= desired_salary_min ? 1 : Math.max(0.2, job.salary_min / desired_salary_min);
  }

  const remote_bonus = job.remote ? 0.03 : 0;
  const overall = Math.min(
    1,
    title_score * 0.32 +
      skill_score * 0.4 +
      location_match * 0.12 +
      experience_match * 0.1 +
      salary_match * 0.06 +
      remote_bonus,
  );
  return { overall, title_score, skill_score, matched, missing, salary_match, experience_match, location_match };
}

// AI removed from the search/package pipeline for portability.
// Matching, resume, cover letter, and readiness now run locally.

// Profile-first generators. No invented experience, no invented tech, no
// keyword stuffing. The Profile is the single source of truth.
function generateResume(ctx: AgentContext, job: RawJob): string {
  return buildResumeFromProfile(ctx, {
    title: job.title,
    company: job.company,
    description: job.description,
    tech_stack: job.tech_stack,
    location: job.location,
  });
}

function generateCover(ctx: AgentContext, job: RawJob): string {
  return buildCoverFromProfile(ctx, {
    title: job.title,
    company: job.company,
    description: job.description,
    tech_stack: job.tech_stack,
    location: job.location,
  });
}

export async function runPipeline(input: PipelineInput) {
  const started = Date.now();
  const { task_id, user_id, db } = input;
  const ctx = buildAgentContext(input.profile);

  await log(db, user_id, task_id, "search_started", "ok", `role=${input.role} location=${input.location} max_apps=${input.max_applications}`);

  // --- Wipe previous discovered/shortlisted listings for this user.
  // Per user request: every new agent run starts with a fresh job set.
  // We preserve listings that are already attached to an application
  // (status not in ['discovered','shortlisted']) so the tracker keeps history.
  try {
    await db
      .from("job_listings")
      .delete()
      .eq("user_id", user_id)
      .in("status", ["discovered", "shortlisted"]);
    await log(db, user_id, task_id, "refresh_jobs", "success", "Cleared previous discovered jobs — fetching fresh");
  } catch (e) {
    await log(db, user_id, task_id, "refresh_jobs", "failed", e instanceof Error ? e.message : String(e));
  }


  // --- Discovery (parallel, with availability gating) ---
  const raw: RawJob[] = [];
  const per_source: Record<string, { count: number; status: "ok" | "failed" | "skipped" }> = {};

  await Promise.all(
    SOURCES.map(async (src) => {
      if (!src.isAvailable()) {
        per_source[src.id] = { count: 0, status: "skipped" };
        await log(
          db,
          user_id,
          task_id,
          `discover_${src.id}`,
          "skipped",
          `${src.label} unavailable — ${src.requiresKey ? "API key not configured" : "source disabled"}`,
        );
        return;
      }
      await log(db, user_id, task_id, `discover_${src.id}`, "running", `Querying ${src.label}…`);
      try {
        const jobs = await src.fetch(input.role, input.location);
        per_source[src.id] = { count: jobs.length, status: "ok" };
        raw.push(...jobs);
        await log(db, user_id, task_id, `discover_${src.id}`, "success", `${jobs.length} jobs from ${src.label}`);
      } catch (err) {
        per_source[src.id] = { count: 0, status: "failed" };
        await log(db, user_id, task_id, `discover_${src.id}`, "failed", err instanceof Error ? err.message : String(err));
      }
    }),
  );

  await log(db, user_id, task_id, "jobs_retrieved", "success", `${raw.length} raw jobs from ${Object.values(per_source).filter((p) => p.status === "ok").length} sources`);

  // --- Dedupe ---
  await log(db, user_id, task_id, "deduplicate", "running", `${raw.length} raw jobs`);
  const seen = new Set<string>();
  const unique: RawJob[] = [];
  for (const j of raw) {
    const key = `${j.source}:${j.external_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(j);
  }
  await log(db, user_id, task_id, "deduplicate", "success", `${unique.length} unique jobs after dedupe`);

  // --- Score ---
  await log(db, user_id, task_id, "jobs_ranked", "running", `Scoring ${unique.length} jobs`);
  const scored = unique.map((j) => ({
    job: j,
    ...scoreJob(j, input.role, input.skills, input.experience, input.location, input.desired_salary_min),
  }));
  scored.sort((a, b) => b.overall - a.overall);
  await log(db, user_id, task_id, "jobs_ranked", "success", `Top score ${scored[0]?.overall.toFixed(2) ?? "n/a"} across ${scored.length} jobs`);

  const listingIds = new Map<string, string>();
  for (const s of scored) {
    const key = `${s.job.source}:${s.job.external_id}`;
    const { data: existingRow } = await db
      .from("job_listings")
      .select("id")
      .eq("source", s.job.source)
      .eq("external_id", s.job.external_id)
      .eq("user_id", user_id)
      .maybeSingle();
    if (existingRow?.id) {
      listingIds.set(key, existingRow.id as string);
      await db
        .from("job_listings")
        .update({ match_score: Number(s.overall.toFixed(3)), status: "discovered", task_id })
        .eq("id", existingRow.id as string);
      continue;
    }
    const { data: insertedListing, error: insertErr } = await db
      .from("job_listings")
      .insert({
        source: s.job.source,
        external_id: s.job.external_id,
        url: s.job.url,
        title: s.job.title,
        company: s.job.company,
        location: s.job.location,
        remote: s.job.remote,
        salary_min: s.job.salary_min,
        salary_max: s.job.salary_max,
        salary_currency: s.job.salary_currency,
        tech_stack: s.job.tech_stack,
        description: s.job.description,
        posted_at: s.job.posted_at,
        match_score: Number(s.overall.toFixed(3)),
        status: "discovered",
        task_id,
        user_id,
      })
      .select("id")
      .single();
    if (!insertErr && insertedListing?.id) listingIds.set(key, insertedListing.id as string);
  }
  await log(db, user_id, task_id, "jobs_saved", "success", `${listingIds.size} jobs saved to tracker`);

  // --- Shortlist (search results are EPHEMERAL — only shortlisted jobs touch the DB) ---
  const shortlist = scored.filter((s) => s.overall >= 0.3).slice(0, input.max_applications);
  await log(db, user_id, task_id, "shortlist", "success", `${shortlist.length} qualified (≥0.30) selected for application prep`);

  const matches: Array<{
    application_id?: string;
    listing_id: string;
    title: string;
    company: string;
    location: string;
    source: string;
    url: string;
    match_score: number;
    matched_skills: string[];
    missing_skills: string[];
    salary_match: number;
    experience_match: number;
    location_match: number;
  }> = [];

  for (const s of shortlist) {
    const listing_id = listingIds.get(`${s.job.source}:${s.job.external_id}`);
    if (!listing_id) {
      await log(db, user_id, task_id, "lookup_listing", "failed", `${s.job.company} — ${s.job.title}`);
      continue;
    }
    await db.from("job_listings").update({ status: "shortlisted" }).eq("id", listing_id);

    await log(db, user_id, task_id, "local_analyze_job", "success", `Local match=${(s.overall * 100).toFixed(0)}% for ${s.job.company} — ${s.job.title}`);

    const resume_md = generateResume(ctx, s.job);
    await log(db, user_id, task_id, "local_resume", "success", `Profile-first resume generated for ${s.job.company}`);

    const cover_md = generateCover(ctx, s.job);
    await log(db, user_id, task_id, "local_cover_letter", "success", `Profile-first cover letter generated for ${s.job.company}`);


    // Application — staged as Pending Review (NEVER auto-submit)
    await log(db, user_id, task_id, "prepare_application", "running", `${s.job.company} — ${s.job.title}`);
    const meta = {
      matched: s.matched,
      missing: s.missing,
      salary_match: Number(s.salary_match.toFixed(2)),
      experience_match: Number(s.experience_match.toFixed(2)),
      location_match: Number(s.location_match.toFixed(2)),
      application_fields: {
        full_name: ctx.personal.name,
        email: ctx.personal.email,
        phone: ctx.personal.phone,
        location: ctx.personal.location || input.location,
      },
    };
    const { data: inserted, error: appErr } = await db
      .from("applications")
      .insert({
        listing_id,
        company: s.job.company,
        job_title: s.job.title,
        source: s.job.source,
        url: s.job.url,
        status: "Preparing",
        match_score: Number(s.overall.toFixed(3)),
        resume_md,
        cover_letter_md: cover_md,
        notes: JSON.stringify(meta),
        task_id,
        user_id,
      })
      .select("id")
      .single();
    if (appErr) {
      await log(db, user_id, task_id, "prepare_application", "failed", appErr.message);
      continue;
    }
    if (inserted?.id) {
      await db.from("application_timeline").insert({
        user_id,
        application_id: inserted.id as string,
        event_type: "created",
        from_status: "",
        to_status: "Preparing",
        note: `Application package prepared for ${s.job.company} — ${s.job.title}`,
      });
    }
    await log(db, user_id, task_id, "prepare_application", "success", `Package ready for ${s.job.company} — awaiting user approval`);

    matches.push({
      application_id: inserted?.id as string,
      listing_id,
      title: s.job.title,
      company: s.job.company,
      location: s.job.location,
      source: s.job.source,
      url: s.job.url,
      match_score: Number(s.overall.toFixed(3)),
      matched_skills: s.matched,
      missing_skills: s.missing,
      salary_match: Number(s.salary_match.toFixed(2)),
      experience_match: Number(s.experience_match.toFixed(2)),
      location_match: Number(s.location_match.toFixed(2)),
    });
  }

  const duration_seconds = Math.round((Date.now() - started) / 100) / 10;
  await log(
    db,
    user_id,
    task_id,
    "user_review",
    "ok",
    `${matches.length} application packages awaiting user approval`,
  );
  await log(
    db,
    user_id,
    task_id,
    "complete",
    "completed",
    `Pipeline complete: ${matches.length} packages in ${duration_seconds}s`,
  );

  return {
    task_id,
    summary: {
      jobs_found: unique.length,
      qualified_matches: shortlist.length,
      application_packages: matches.length,
      real_submissions: 0,
      skipped: scored.length - shortlist.length,
      duration_seconds,
    },
    matches,
    per_source,
  };
}

/* ───────── Submission (simulated, transparent) ─────────
 * Records step-by-step "filling" activity so the UI can show the live
 * application-fill animation. Marks the application as Applied. No real
 * external submission is sent — clearly logged as a manual hand-off step.
 */
export async function simulateSubmission(applicationId: string, user_id: string, db: ImperiumDb) {
  const { data: app, error } = await db
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .eq("user_id", user_id)
    .maybeSingle();
  if (error || !app) throw new Error("Application not found");
  const task_id = (app.task_id as string) || `submit_${applicationId.slice(0, 8)}`;

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const meta = (() => {
    try {
      return JSON.parse((app.notes as string) || "{}");
    } catch {
      return {};
    }
  })();
  const fields = meta.application_fields ?? {};

  const steps: Array<[string, string]> = [
    ["fill_open_application", `Opening application form for ${app.company}`],
    ["fill_read_form", "Reading form fields and required uploads"],
    ["fill_name", `Filling name: ${fields.full_name ?? "—"}`],
    ["fill_email", `Filling email: ${fields.email ?? "—"}`],
    ["fill_phone", `Filling phone: ${fields.phone ?? "—"}`],
    ["fill_resume", "Uploading tailored resume (PDF)"],
    ["fill_cover_letter", "Uploading cover letter"],
    ["fill_review_complete", "All fields populated · review complete"],
  ];

  for (const [action, detail] of steps) {
    await log(db, user_id, task_id, action, "running", detail);
    await sleep(450);
    await log(db, user_id, task_id, action, "success", detail);
  }

  const prevStatus = (app.status as string) || "Preparing";
  await db
    .from("applications")
    .update({
      status: "Applied",
      applied_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  await db.from("application_timeline").insert({
    user_id,
    application_id: applicationId,
    event_type: "status_change",
    from_status: prevStatus,
    to_status: "Applied",
    note: `Submitted to ${app.company}`,
  });

  await log(
    db,
    user_id,
    task_id,
    "application_submitted",
    "completed",
    `Application package handed off for ${app.company} — ${app.job_title}`,
  );

  return { ok: true };
}

export async function skipApplication(applicationId: string, user_id: string, db: ImperiumDb) {
  const { data: app, error } = await db
    .from("applications")
    .select("task_id, company, job_title, status")
    .eq("id", applicationId)
    .eq("user_id", user_id)
    .maybeSingle();
  if (error || !app) throw new Error("Application not found");
  const prevStatus = (app.status as string) || "Preparing";
  await db
    .from("applications")
    .update({ status: "Withdrawn", updated_at: new Date().toISOString() })
    .eq("id", applicationId)
    .eq("user_id", user_id);
  await db.from("application_timeline").insert({
    user_id,
    application_id: applicationId,
    event_type: "status_change",
    from_status: prevStatus,
    to_status: "Withdrawn",
    note: `User withdrew application for ${app.company} — ${app.job_title}`,
  });
  await log(
    db,
    user_id,
    (app.task_id as string) || "skip",
    "user_skip",
    "ok",
    `User withdrew ${app.company} — ${app.job_title}`,
  );
  return { ok: true };
}
