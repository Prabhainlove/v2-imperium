/**
 * src/routes/api/public/agent-callback.ts
 * =======================================
 * B8 — HMAC-signed callback endpoint that the local Python agent posts to
 * when a run reaches a terminal state.
 *
 * Security
 *   - Verifies `X-Imperium-Signature: sha256=<hex>` against
 *     `IMPERIUM_CALLBACK_SECRET` (constant-time compare).
 *   - Refuses unsigned or unconfigured requests with 401.
 *
 * Side-effects
 *   - Locates the application by `local_agent_job_id` stored inside the
 *     `applications.notes` JSON field (no migration required — Phase 1).
 *   - Maps agent status → application status (B9 introduces
 *     `ManualApplyPending`).
 *   - Inserts a row in `application_timeline` for traceability.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Imperium-Signature",
} as const;

type AgentStatus =
  | "submitted"
  | "awaiting_approval"
  | "needs_human"
  | "failed"
  | "rejected";

/** B9 — explicit human-action-required state for jobs the agent could not
 * finish (Naukri redirects, external ATS, captcha, login wall, etc.). */
const STATUS_MAP: Record<AgentStatus, string> = {
  submitted: "Applied",
  awaiting_approval: "ManualApplyPending",
  needs_human: "ManualApplyPending",
  failed: "ManualApplyPending",
  rejected: "Withdrawn",
};

function verifySignature(secret: string, body: string, header: string | null): boolean {
  if (!header || !header.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const provided = header.slice("sha256=".length).trim();
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided, "hex");
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/agent-callback")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      POST: async ({ request }) => {
        const secret = process.env.IMPERIUM_CALLBACK_SECRET;
        if (!secret) {
          return new Response(JSON.stringify({ error: "callback_disabled" }), {
            status: 401,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }
        const raw = await request.text();
        const sig = request.headers.get("x-imperium-signature");
        if (!verifySignature(secret, raw, sig)) {
          return new Response(JSON.stringify({ error: "bad_signature" }), {
            status: 401,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }

        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          return new Response(JSON.stringify({ error: "bad_json" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }

        const jobId = String(payload.job_id ?? "").trim();
        const agentStatus = String(payload.status ?? "").trim() as AgentStatus;
        if (!jobId || !(agentStatus in STATUS_MAP)) {
          return new Response(JSON.stringify({ error: "bad_payload" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Locate application by local_agent_job_id embedded in notes JSON.
        // We do not have a dedicated column in Phase 1 (no migrations).
        const { data: candidates } = await supabaseAdmin
          .from("applications")
          .select("id, user_id, status, notes, company, job_title")
          .ilike("notes", `%${jobId}%`)
          .limit(5);

        const app = (candidates ?? []).find((row) => {
          try {
            const meta = JSON.parse(String(row.notes ?? "{}")) as Record<string, unknown>;
            return meta.local_agent_job_id === jobId;
          } catch {
            return false;
          }
        });

        if (!app) {
          // Idempotent: unknown job_id is not a server error — the run may
          // have been triggered manually outside any application package.
          return new Response(JSON.stringify({ ok: true, matched: false }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }

        const next = STATUS_MAP[agentStatus];
        const prev = (app.status as string) || "";
        const patch: Record<string, unknown> = {
          status: next,
          updated_at: new Date().toISOString(),
        };
        if (next === "Applied") patch.applied_at = new Date().toISOString();

        const { error: updErr } = await supabaseAdmin
          .from("applications")
          .update(patch as never)
          .eq("id", app.id as string);
        if (updErr) {
          return new Response(JSON.stringify({ error: updErr.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }

        await supabaseAdmin.from("application_timeline").insert({
          user_id: app.user_id as string,
          application_id: app.id as string,
          event_type: "agent_callback",
          from_status: prev,
          to_status: next,
          note: `Local agent → ${agentStatus} (${String(payload.error || "ok")})`,
        });

        return new Response(
          JSON.stringify({ ok: true, matched: true, status: next }),
          { status: 200, headers: { "Content-Type": "application/json", ...CORS } },
        );
      },
    },
  },
});
