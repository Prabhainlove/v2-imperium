/**
 * Imperium "self-thinking" stream endpoint.
 *
 * POST /api/imperium/think with { mode, payload } returns a Server-Sent
 * Events stream of thinking steps + final structured result.
 *
 * Modes:
 *   - "full"          : profile → job analysis → resume opt → cover letter → plan
 *   - "candidate"     : profile analysis only
 *   - "job"           : single job analysis
 *   - "resume"        : optimize resume for a job
 *   - "cover"         : cover letter only
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import {
  analyzeCandidate,
  analyzeJob,
  generateCoverLetter,
  optimizeResume,
  planApplication,
  type Emit,
} from "@/lib/imperium/intelligence.server";

type Body = {
  mode?: "full" | "candidate" | "job" | "resume" | "cover";
  job?: {
    title: string;
    company: string;
    description?: string;
    tech_stack?: string[];
  };
  resume_md?: string;
  override_candidate?: Record<string, unknown>;
};

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function loadCandidate(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const url = process.env.SUPABASE_URL!;
  const anon = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const sb = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: user } = await sb.auth.getUser();
  if (!user?.user) return null;
  const { data } = await sb
    .from("profiles")
    .select("*")
    .eq("id", user.user.id)
    .maybeSingle();
  return data ?? null;
}

export const Route = createFileRoute("/api/imperium/think")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as Body;
        const mode = body.mode ?? "full";
        const candidateRow = await loadCandidate(request);
        const candidate =
          body.override_candidate ??
          (candidateRow
            ? {
                name: candidateRow.name,
                headline: candidateRow.headline,
                summary: candidateRow.summary,
                skills: candidateRow.skills,
                experience: candidateRow.experience,
                education: candidateRow.education,
                linkedin_url: candidateRow.linkedin_url,
                github_url: candidateRow.github_url,
                portfolio_url: candidateRow.portfolio_url,
              }
            : { name: "Anonymous", skills: [] });

        const stream = new ReadableStream({
          async start(controller) {
            const enc = new TextEncoder();
            let counter = 0;
            const emit: Emit = (s) => {
              counter += 1;
              controller.enqueue(
                enc.encode(
                  sse("thinking", {
                    id: `s_${counter}`,
                    label: s.label,
                    detail: s.detail ?? "",
                    status: s.status ?? "running",
                    ts: Date.now(),
                  }),
                ),
              );
            };

            try {
              controller.enqueue(
                enc.encode(sse("start", { mode, at: Date.now() })),
              );

              if (mode === "candidate" || mode === "full") {
                const analysis = await analyzeCandidate(
                  candidate as Parameters<typeof analyzeCandidate>[0],
                  emit,
                );
                controller.enqueue(
                  enc.encode(sse("candidate", analysis)),
                );
                if (mode === "candidate") {
                  controller.enqueue(enc.encode(sse("done", { ok: true })));
                  controller.close();
                  return;
                }
              }

              if (!body.job) {
                throw new Error("job is required for this mode");
              }
              const job = body.job;

              const jobAnalysis = await analyzeJob(
                candidate as Parameters<typeof analyzeJob>[0],
                job,
                emit,
              );
              controller.enqueue(enc.encode(sse("job", jobAnalysis)));
              if (mode === "job") {
                controller.enqueue(enc.encode(sse("done", { ok: true })));
                controller.close();
                return;
              }

              const resumeBase =
                body.resume_md ??
                `# ${candidate.name ?? "Candidate"}\n\n${candidate.summary ?? ""}\n\n## Skills\n${(candidate.skills as string[] | undefined ?? []).join(", ")}`;

              const resumeOpt = await optimizeResume(resumeBase, job, emit);
              controller.enqueue(enc.encode(sse("resume", resumeOpt)));
              if (mode === "resume") {
                controller.enqueue(enc.encode(sse("done", { ok: true })));
                controller.close();
                return;
              }

              const cover = await generateCoverLetter(
                candidate as Parameters<typeof generateCoverLetter>[0],
                job,
                emit,
              );
              controller.enqueue(enc.encode(sse("cover", cover)));
              if (mode === "cover") {
                controller.enqueue(enc.encode(sse("done", { ok: true })));
                controller.close();
                return;
              }

              const plan = await planApplication(
                {
                  candidate,
                  job,
                  job_analysis: jobAnalysis,
                  resume_opt: resumeOpt,
                },
                emit,
              );
              controller.enqueue(enc.encode(sse("plan", plan)));
              controller.enqueue(enc.encode(sse("done", { ok: true })));
              controller.close();
            } catch (err) {
              controller.enqueue(
                enc.encode(
                  sse("error", {
                    message: (err as Error).message ?? "thinking failed",
                  }),
                ),
              );
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
