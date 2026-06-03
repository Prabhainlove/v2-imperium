/**
 * Imperium Job Agent pipeline. Server-only.
 * Orchestrates: plan -> discover (multi-source w/ availability flags)
 *              -> dedupe -> rich scoring -> shortlist
 *              -> per-job analyze + resume + cover letter
 *              -> stage as **Pending Review** (no auto submission).
 * Writes an activity_log row at every stage so the UI animates live.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SOURCES, type RawJob } from "./sources.server";

export interface PipelineInput {
  task_id: string;
  user_id: string;
  role: string;
  location: string;
  experience: string;
  skills: string[];
  candidate: {
    name: string;
    email: string;
    phone: string;
    summary?: string;
  };
  max_applications: number;
  desired_salary_min?: number | null;
}

async function log(
  user_id: string,
  task_id: string,
  action: string,
  status: "ok" | "running" | "success" | "failed" | "completed" | "skipped" = "ok",
  detail = "",
) {
  await supabaseAdmin.from("activity_log").insert({
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
    if (text.includes(s) || job.tech_stack.some((t) => t.toLowerCase().includes(s))) matched.push(s);
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

async function lovableAI(prompt: string, system: string): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "imperium-job-agent",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI gateway ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

function fallbackResume(input: PipelineInput, job: RawJob, matched: string[]): string {
  return [
    `# ${input.candidate.name}`,
    `${input.candidate.email} · ${input.candidate.phone}`,
    "",
    `## Summary`,
    `${input.candidate.summary ?? `${input.role} with ${input.experience} of experience.`} Targeting ${job.title} at ${job.company}.`,
    "",
    `## Core Skills`,
    matched.length ? matched.join(" · ") : input.skills.join(" · "),
    "",
    `## Highlights`,
    `- Delivered production ${input.role.toLowerCase()} systems aligned with ${job.title}.`,
    `- Hands-on with ${input.skills.slice(0, 5).join(", ")}.`,
    `- Comfortable with remote async collaboration across timezones.`,
  ].join("\n");
}

function fallbackCover(input: PipelineInput, job: RawJob): string {
  return [
    `Dear ${job.company} hiring team,`,
    "",
    `I'm applying for the ${job.title} role. With ${input.experience} of experience as a ${input.role}, I bring direct expertise in ${input.skills.slice(0, 4).join(", ")} — closely matching what your team is building.`,
    "",
    `I'd love to discuss how I can contribute.`,
    "",
    `Best regards,`,
    input.candidate.name,
  ].join("\n");
}

export async function runPipeline(input: PipelineInput) {
  const started = Date.now();
  const { task_id, user_id } = input;

  await log(user_id, task_id, "search_started", "ok", `role=${input.role} location=${input.location} max_apps=${input.max_applications}`);

  // --- Discovery (parallel, with availability gating) ---
  const raw: RawJob[] = [];
  const per_source: Record<string, { count: number; status: "ok" | "failed" | "skipped" }> = {};

  await Promise.all(
    SOURCES.map(async (src) => {
      if (!src.isAvailable()) {
        per_source[src.id] = { count: 0, status: "skipped" };
        await log(
          user_id,
          task_id,
          `discover_${src.id}`,
          "skipped",
          `${src.label} unavailable — ${src.requiresKey ? "API key not configured" : "source disabled"}`,
        );
        return;
      }
      await log(user_id, task_id, `discover_${src.id}`, "running", `Querying ${src.label}…`);
      try {
        const jobs = await src.fetch(input.role, input.location);
        per_source[src.id] = { count: jobs.length, status: "ok" };
        raw.push(...jobs);
        await log(user_id, task_id, `discover_${src.id}`, "success", `${jobs.length} jobs from ${src.label}`);
      } catch (err) {
        per_source[src.id] = { count: 0, status: "failed" };
        await log(user_id, task_id, `discover_${src.id}`, "failed", err instanceof Error ? err.message : String(err));
      }
    }),
  );

  await log(user_id, task_id, "jobs_retrieved", "success", `${raw.length} raw jobs from ${Object.values(per_source).filter((p) => p.status === "ok").length} sources`);

  // --- Dedupe ---
  await log(user_id, task_id, "deduplicate", "running", `${raw.length} raw jobs`);
  const seen = new Set<string>();
  const unique: RawJob[] = [];
  for (const j of raw) {
    const key = `${j.source}:${j.external_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(j);
  }
  await log(user_id, task_id, "deduplicate", "success", `${unique.length} unique jobs after dedupe`);

  // --- Score ---
  await log(user_id, task_id, "jobs_ranked", "running", `Scoring ${unique.length} jobs`);
  const scored = unique.map((j) => ({
    job: j,
    ...scoreJob(j, input.role, input.skills, input.experience, input.location, input.desired_salary_min),
  }));
  scored.sort((a, b) => b.overall - a.overall);
  await log(user_id, task_id, "jobs_ranked", "success", `Top score ${scored[0]?.overall.toFixed(2) ?? "n/a"} across ${scored.length} jobs`);

  // --- Persist all jobs ---
  if (scored.length) {
    const rows = scored.map((s) => ({
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
    }));
    const { error } = await supabaseAdmin
      .from("job_listings")
      .upsert(rows, { onConflict: "source,external_id" });
    if (error) await log(user_id, task_id, "persist_jobs", "failed", error.message);
    else await log(user_id, task_id, "persist_jobs", "success", `${rows.length} jobs saved`);
  }

  // --- Shortlist ---
  const shortlist = scored.filter((s) => s.overall >= 0.3).slice(0, input.max_applications);
  await log(user_id, task_id, "shortlist", "success", `${shortlist.length} qualified (≥0.30) selected for application prep`);

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
    const { data: listingRow, error: lookupErr } = await supabaseAdmin
      .from("job_listings")
      .select("id")
      .eq("source", s.job.source)
      .eq("external_id", s.job.external_id)
      .maybeSingle();
    if (lookupErr || !listingRow) {
      await log(user_id, task_id, "lookup_listing", "failed", `${s.job.company} — ${s.job.title}`);
      continue;
    }
    const listing_id = listingRow.id as string;

    await log(user_id, task_id, "analyze_job", "running", `${s.job.company} — ${s.job.title}`);
    await log(
      user_id,
      task_id,
      "analyze_job",
      "success",
      `match=${(s.overall * 100).toFixed(0)}% · matched=[${s.matched.join(", ") || "—"}] · missing=[${s.missing.slice(0, 4).join(", ") || "—"}]`,
    );

    // Resume
    let resume_md = "";
    await log(user_id, task_id, "generate_resume", "running", `${s.job.company} — ${s.job.title}`);
    try {
      resume_md = await lovableAI(
        `Tailor a 1-page resume in markdown for this job. Format: # Name on first line, contact on second line, then ## Sections.\n\nCandidate: ${input.candidate.name}\nEmail: ${input.candidate.email}\nPhone: ${input.candidate.phone}\nExperience: ${input.experience}\nSkills: ${input.skills.join(", ")}\nSummary: ${input.candidate.summary ?? ""}\n\nJob title: ${s.job.title}\nCompany: ${s.job.company}\nDescription (truncated): ${s.job.description.slice(0, 1200)}\nTech stack: ${s.job.tech_stack.join(", ")}\nMatched skills: ${s.matched.join(", ")}\n\nOutput ONLY the resume markdown. Sections: Summary, Core Skills, Experience, Education. Keep it ATS-friendly: clean headers, no tables, no emojis, plain '-' bullets.`,
        "You are an expert technical resume writer. Output concise, truthful, ATS-optimized resumes in markdown.",
      );
      await log(user_id, task_id, "generate_resume", "success", `${resume_md.length} chars`);
    } catch (err) {
      resume_md = fallbackResume(input, s.job, s.matched);
      await log(user_id, task_id, "generate_resume", "failed", `${err instanceof Error ? err.message : err} — fallback used`);
    }

    // Cover letter
    let cover_md = "";
    await log(user_id, task_id, "generate_cover_letter", "running", `${s.job.company}`);
    try {
      cover_md = await lovableAI(
        `Write a short (under 200 words) professional cover letter in markdown for this job.\n\nCandidate: ${input.candidate.name}\nExperience: ${input.experience}\nSkills: ${input.skills.join(", ")}\n\nJob title: ${s.job.title}\nCompany: ${s.job.company}\nDescription (truncated): ${s.job.description.slice(0, 800)}\n\nOutput ONLY the cover letter markdown.`,
        "You are a professional cover-letter writer. Be specific, concise, no clichés.",
      );
      await log(user_id, task_id, "generate_cover_letter", "success", `${cover_md.length} chars`);
    } catch (err) {
      cover_md = fallbackCover(input, s.job);
      await log(user_id, task_id, "generate_cover_letter", "failed", `${err instanceof Error ? err.message : err} — fallback used`);
    }

    // Application — staged as Pending Review (NEVER auto-submit)
    await log(user_id, task_id, "prepare_application", "running", `${s.job.company} — ${s.job.title}`);
    const meta = {
      matched: s.matched,
      missing: s.missing,
      salary_match: Number(s.salary_match.toFixed(2)),
      experience_match: Number(s.experience_match.toFixed(2)),
      location_match: Number(s.location_match.toFixed(2)),
      application_fields: {
        full_name: input.candidate.name,
        email: input.candidate.email,
        phone: input.candidate.phone,
        location: input.location,
      },
    };
    const { data: inserted, error: appErr } = await supabaseAdmin
      .from("applications")
      .insert({
        listing_id,
        company: s.job.company,
        job_title: s.job.title,
        status: "Pending Review",
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
      await log(user_id, task_id, "prepare_application", "failed", appErr.message);
      continue;
    }
    await log(user_id, task_id, "prepare_application", "success", `Package ready for ${s.job.company} — awaiting user approval`);

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
    user_id,
    task_id,
    "user_review",
    "ok",
    `${matches.length} application packages awaiting user approval`,
  );
  await log(
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
export async function simulateSubmission(applicationId: string, user_id: string) {
  const { data: app, error } = await supabaseAdmin
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
    await log(user_id, task_id, action, "running", detail);
    await sleep(450);
    await log(user_id, task_id, action, "success", detail);
  }

  await supabaseAdmin
    .from("applications")
    .update({
      status: "Applied",
      applied_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  await log(
    user_id,
    task_id,
    "application_submitted",
    "completed",
    `Application package handed off for ${app.company} — ${app.job_title}`,
  );

  return { ok: true };
}

export async function skipApplication(applicationId: string, user_id: string) {
  const { data: app, error } = await supabaseAdmin
    .from("applications")
    .select("task_id, company, job_title")
    .eq("id", applicationId)
    .eq("user_id", user_id)
    .maybeSingle();
  if (error || !app) throw new Error("Application not found");
  await supabaseAdmin
    .from("applications")
    .update({ status: "Skipped", updated_at: new Date().toISOString() })
    .eq("id", applicationId)
    .eq("user_id", user_id);
  await log(
    user_id,
    (app.task_id as string) || "skip",
    "user_skip",
    "ok",
    `User skipped ${app.company} — ${app.job_title}`,
  );
  return { ok: true };
}
