/**
 * Imperium Job Agent pipeline. Server-only.
 * Orchestrates: plan -> discover -> dedupe -> score -> shortlist
 *              -> generate_resume + cover_letter -> prepare application.
 * Writes an activity_log row at every stage so the UI animates live.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SOURCES, type RawJob } from "./sources.server";

export interface PipelineInput {
  task_id: string;
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
}

async function log(
  task_id: string,
  action: string,
  status: "ok" | "running" | "success" | "failed" | "completed" = "ok",
  detail = "",
) {
  await supabaseAdmin.from("activity_log").insert({
    task_id,
    agent: "job_agent",
    action,
    status,
    detail,
  });
}

function scoreJob(
  job: RawJob,
  role: string,
  skills: string[],
): { score: number; matched: string[]; missing: string[] } {
  const text = `${job.title} ${job.description} ${job.tech_stack.join(" ")}`.toLowerCase();
  const role_terms = role.toLowerCase().split(/\s+/).filter((s) => s.length > 2);
  let title_hits = 0;
  for (const r of role_terms) if (job.title.toLowerCase().includes(r)) title_hits++;
  const title_score = role_terms.length ? title_hits / role_terms.length : 0;

  const wanted = skills.map((s) => s.toLowerCase().trim()).filter(Boolean);
  const matched: string[] = [];
  const missing: string[] = [];
  for (const s of wanted) {
    if (text.includes(s) || job.tech_stack.some((t) => t.toLowerCase().includes(s))) {
      matched.push(s);
    } else {
      missing.push(s);
    }
  }
  const skill_score = wanted.length ? matched.length / wanted.length : 0.5;
  const remote_bonus = job.remote ? 0.05 : 0;

  const score = Math.min(1, title_score * 0.45 + skill_score * 0.5 + remote_bonus);
  return { score, matched, missing };
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
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
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
  const { task_id } = input;

  await log(task_id, "plan", "ok", `role=${input.role} location=${input.location} max_apps=${input.max_applications}`);

  // --- Discovery
  const raw: RawJob[] = [];
  const per_source: Record<string, number> = {};
  for (const src of SOURCES) {
    await log(task_id, `discover_${src.id}`, "running", `Querying ${src.label}…`);
    try {
      const jobs = await src.fetch(input.role, input.location);
      per_source[src.id] = jobs.length;
      raw.push(...jobs);
      await log(task_id, `discover_${src.id}`, "success", `${jobs.length} jobs from ${src.label}`);
    } catch (err) {
      per_source[src.id] = 0;
      await log(
        task_id,
        `discover_${src.id}`,
        "failed",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  // --- Dedupe
  await log(task_id, "deduplicate", "running", `${raw.length} raw jobs`);
  const seen = new Set<string>();
  const unique: RawJob[] = [];
  for (const j of raw) {
    const key = `${j.source}:${j.external_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(j);
  }
  await log(task_id, "deduplicate", "success", `${unique.length} unique jobs after dedupe`);

  // --- Score
  await log(task_id, "rank_match", "running", `Scoring ${unique.length} jobs`);
  const scored = unique.map((j) => {
    const s = scoreJob(j, input.role, input.skills);
    return { job: j, ...s };
  });
  scored.sort((a, b) => b.score - a.score);
  await log(task_id, "rank_match", "success", `Top score ${scored[0]?.score.toFixed(2) ?? "n/a"}`);

  // --- Persist all jobs (UPSERT)
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
      match_score: Number(s.score.toFixed(3)),
      status: "discovered",
      task_id,
    }));
    const { error } = await supabaseAdmin
      .from("job_listings")
      .upsert(rows, { onConflict: "source,external_id" });
    if (error) await log(task_id, "persist_jobs", "failed", error.message);
    else await log(task_id, "persist_jobs", "success", `${rows.length} jobs saved`);
  }

  // --- Shortlist
  const shortlist = scored.filter((s) => s.score >= 0.35).slice(0, input.max_applications);
  await log(
    task_id,
    "shortlist",
    "success",
    `${shortlist.length} qualified (≥0.35) selected for application prep`,
  );

  const matches: Array<{
    listing_id: string;
    title: string;
    company: string;
    location: string;
    source: string;
    url: string;
    match_score: number;
    matched_skills: string[];
    missing_skills: string[];
  }> = [];

  // --- Per-job: resume + cover letter + application
  for (const s of shortlist) {
    const { data: listingRow, error: lookupErr } = await supabaseAdmin
      .from("job_listings")
      .select("id")
      .eq("source", s.job.source)
      .eq("external_id", s.job.external_id)
      .maybeSingle();
    if (lookupErr || !listingRow) {
      await log(task_id, "lookup_listing", "failed", `${s.job.company} — ${s.job.title}`);
      continue;
    }
    const listing_id = listingRow.id as string;

    await log(task_id, "analyze_job", "running", `${s.job.company} — ${s.job.title}`);
    await log(task_id, "analyze_job", "success", `matched: ${s.matched.join(", ") || "—"}`);

    // Resume
    let resume_md = "";
    await log(task_id, "generate_resume", "running", `${s.job.company} — ${s.job.title}`);
    try {
      resume_md = await lovableAI(
        `Tailor a 1-page resume in markdown for this job.\n\nCandidate: ${input.candidate.name}\nEmail: ${input.candidate.email}\nExperience: ${input.experience}\nSkills: ${input.skills.join(", ")}\nSummary: ${input.candidate.summary ?? ""}\n\nJob title: ${s.job.title}\nCompany: ${s.job.company}\nDescription (truncated): ${s.job.description.slice(0, 1200)}\nTech stack: ${s.job.tech_stack.join(", ")}\nMatched skills: ${s.matched.join(", ")}\n\nOutput ONLY the resume markdown. Keep it ATS-friendly: clean headers, no tables, no emojis.`,
        "You are an expert technical resume writer. Output concise, truthful, ATS-optimized resumes in markdown.",
      );
      await log(task_id, "generate_resume", "success", `${resume_md.length} chars`);
    } catch (err) {
      resume_md = fallbackResume(input, s.job, s.matched);
      await log(
        task_id,
        "generate_resume",
        "failed",
        `${err instanceof Error ? err.message : err} — fallback used`,
      );
    }

    // Cover letter
    let cover_md = "";
    await log(task_id, "generate_cover_letter", "running", `${s.job.company}`);
    try {
      cover_md = await lovableAI(
        `Write a short (under 200 words) professional cover letter in markdown for this job.\n\nCandidate: ${input.candidate.name}\nExperience: ${input.experience}\nSkills: ${input.skills.join(", ")}\n\nJob title: ${s.job.title}\nCompany: ${s.job.company}\nDescription (truncated): ${s.job.description.slice(0, 800)}\n\nOutput ONLY the cover letter markdown.`,
        "You are a professional cover-letter writer. Be specific, concise, no clichés.",
      );
      await log(task_id, "generate_cover_letter", "success", `${cover_md.length} chars`);
    } catch (err) {
      cover_md = fallbackCover(input, s.job);
      await log(
        task_id,
        "generate_cover_letter",
        "failed",
        `${err instanceof Error ? err.message : err} — fallback used`,
      );
    }

    // Application
    await log(task_id, "prepare_application", "running", `${s.job.company} — ${s.job.title}`);
    const { error: appErr } = await supabaseAdmin.from("applications").insert({
      listing_id,
      company: s.job.company,
      job_title: s.job.title,
      status: "Prepared",
      match_score: Number(s.score.toFixed(3)),
      resume_md,
      cover_letter_md: cover_md,
      notes: `Matched: ${s.matched.join(", ")}`,
      task_id,
    });
    if (appErr) {
      await log(task_id, "prepare_application", "failed", appErr.message);
      continue;
    }
    await log(task_id, "prepare_application", "success", `Package ready for ${s.job.company}`);

    matches.push({
      listing_id,
      title: s.job.title,
      company: s.job.company,
      location: s.job.location,
      source: s.job.source,
      url: s.job.url,
      match_score: Number(s.score.toFixed(3)),
      matched_skills: s.matched,
      missing_skills: s.missing,
    });
  }

  const duration_seconds = Math.round((Date.now() - started) / 100) / 10;
  await log(
    task_id,
    "complete",
    "completed",
    `${matches.length} application packages prepared in ${duration_seconds}s`,
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
