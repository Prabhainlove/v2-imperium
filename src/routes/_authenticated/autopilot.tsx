import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Check, Loader2, Play, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/imperium/page-header";
import {
  localAgentApply,
  localAgentApprove,
  localAgentHealth,
  localAgentReject,
  localAgentStatus,
} from "@/core/automation/selenium_bridge";

export const Route = createFileRoute("/_authenticated/autopilot")({
  head: () => ({
    meta: [
      { title: "Autopilot — Imperium" },
      { name: "description", content: "Watch the local automation agent apply to jobs live." },
    ],
  }),
  component: AutopilotPage,
});

interface AgentEvent {
  ts: string;
  step: string;
  action: string;
  level: string;
  url: string;
}

interface AgentRun {
  id: string;
  job_url: string;
  status: string;
  progress: number;
  current_step: string;
  current_action: string;
  current_url: string;
  approved: boolean | null;
  error: string;
  created_at: string;
  updated_at: string;
  events: AgentEvent[];
}

const AGENT_URL_KEY = "imperium.agent_url";
const AGENT_JOB_KEY = "imperium.agent_job_id";
const DEFAULT_AGENT_URL = "http://127.0.0.1:8000";

function statusColor(s: string) {
  switch (s) {
    case "submitted":
    case "approved":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "awaiting_approval":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "running":
    case "queued":
      return "bg-sky-500/15 text-sky-300 border-sky-500/30";
    case "failed":
    case "rejected":
      return "bg-red-500/15 text-red-300 border-red-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function AutopilotPage() {
  const [agentUrl, setAgentUrl] = useState(DEFAULT_AGENT_URL);
  const [agentOnline, setAgentOnline] = useState<boolean | null>(null);
  const [jobUrl, setJobUrl] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [run, setRun] = useState<AgentRun | null>(null);
  const [busy, setBusy] = useState(false);
  const eventScroll = useRef<HTMLDivElement>(null);

  // Load saved settings
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = localStorage.getItem(AGENT_URL_KEY);
    if (url) setAgentUrl(url);
    const id = localStorage.getItem(AGENT_JOB_KEY);
    if (id) setJobId(id);
  }, []);

  // Health-check the local agent (uses shared bridge → token + VITE_LOCAL_AGENT_URL)
  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      try {
        await localAgentHealth();
        if (!cancelled) setAgentOnline(true);
      } catch {
        if (!cancelled) setAgentOnline(false);
      }
    };
    ping();
    const t = setInterval(ping, 5000);
    return () => { cancelled = true; clearInterval(t); };
  }, [agentUrl]);

  // Poll the run status
  useEffect(() => {
    if (!jobId) { setRun(null); return; }
    let cancelled = false;
    const poll = async () => {
      try {
        const data = (await localAgentStatus(jobId)) as unknown as AgentRun;
        if (!cancelled) setRun(data);
      } catch { /* agent offline; keep last state */ }
    };
    poll();
    const t = setInterval(poll, 1000);
    return () => { cancelled = true; clearInterval(t); };
  }, [jobId, agentUrl]);

  useEffect(() => {
    eventScroll.current?.scrollTo({ top: eventScroll.current.scrollHeight });
  }, [run?.events.length]);

  const queueRun = async () => {
    if (!jobUrl.trim()) return toast.error("Enter a job URL first");
    if (!agentOnline) {
      return toast.error(
        `Local agent not reachable at ${agentUrl}. Start it with: cd IMPERIUM/local_agent && python main.py`,
      );
    }

    setBusy(true);
    try {
      if (typeof window !== "undefined") localStorage.setItem(AGENT_URL_KEY, agentUrl);
      const { data: { user } } = await supabase.auth.getUser();
      let profile: Record<string, unknown> = {};
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("name,email,phone,location,headline,summary,linkedin_url,github_url,portfolio_url")
          .eq("id", user.id)
          .maybeSingle();
        profile = data ?? {};
      }
      const { job_id } = await localAgentApply(jobUrl.trim(), profile);
      setJobId(job_id);
      if (typeof window !== "undefined") localStorage.setItem(AGENT_JOB_KEY, job_id);
      toast.success("Agent is opening Chrome locally…");
      setJobUrl("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to queue";
      toast.error(`Failed to queue: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  const send = async (path: "approve" | "reject") => {
    if (!jobId) return;
    try {
      if (path === "approve") await localAgentApprove(jobId);
      else await localAgentReject(jobId);
      toast.success(path === "approve" ? "Approved — submitting…" : "Rejected.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    }
  };

  const clearJob = () => {
    setJobId(null);
    setRun(null);
    if (typeof window !== "undefined") localStorage.removeItem(AGENT_JOB_KEY);
  };

  const isActive = useMemo(
    () => run && ["queued", "running", "awaiting_approval"].includes(run.status),
    [run],
  );

  return (
    <div className="page-font-autopilot space-y-6 p-6">
      <PageHeader
        title="Autopilot"
        kanji="自"
        kanjiLabel="Jidō · 自動 · Auto"
        description="Queue a job URL; the local Selenium agent on your machine opens a real Chrome window, fills the form, streams every action live, and pauses for your approval before submitting. Fully offline — no cloud required."
      />

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_260px_140px]">
          <div className="space-y-1.5">
            <Label htmlFor="url">Job URL</Label>
            <Input id="url" placeholder="https://…" value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="agent">Local agent URL</Label>
            <Input id="agent" value={agentUrl} onChange={(e) => setAgentUrl(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={queueRun} disabled={busy} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Play className="mr-2 h-4 w-4" /> Run</>}
            </Button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span className={`inline-block h-2 w-2 rounded-full ${agentOnline ? "bg-emerald-500" : "bg-red-500"}`} />
          {agentOnline === null ? "Checking local agent…" : agentOnline ? "Local agent online" : "Local agent offline"}
          <span className="ml-2">·</span>
          <code className="rounded bg-muted px-1.5 py-0.5">cd IMPERIUM/local_agent &amp;&amp; python main.py</code>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Current run</span>
              {run && (
                <Badge variant="outline" className={statusColor(run.status)}>
                  {run.status}
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground truncate max-w-[40%]" title={run?.current_url}>
              {run?.current_url || "—"}
            </div>
          </div>
          {run ? (
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div>
                  <div className="font-medium">{run.current_step || "—"}</div>
                  <div className="text-xs text-muted-foreground">{run.current_action || ""}</div>
                </div>
                <div className="flex gap-2">
                  {run.status === "awaiting_approval" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => send("reject")}>
                        <X className="mr-1 h-3.5 w-3.5" /> Reject
                      </Button>
                      <Button size="sm" onClick={() => send("approve")}>
                        <Check className="mr-1 h-3.5 w-3.5" /> Approve &amp; submit
                      </Button>
                    </>
                  )}
                  {!isActive && (
                    <Button size="sm" variant="ghost" onClick={clearJob}>Clear</Button>
                  )}
                </div>
              </div>
              <Progress value={run.progress} />
              <div className="text-xs text-muted-foreground truncate">
                <span className="opacity-60">Job URL:</span> {run.job_url}
              </div>
              {run.error && (
                <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {run.error}
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No active run. Paste a job URL above and click Run.
            </div>
          )}
        </Card>

        <Card className="flex flex-col">
          <div className="border-b border-border px-4 py-2.5 text-sm font-medium">Live activity</div>
          <div ref={eventScroll} className="max-h-[480px] flex-1 overflow-y-auto p-3 space-y-2">
            {!run || run.events.length === 0 ? (
              <div className="p-4 text-xs text-muted-foreground">No events yet.</div>
            ) : (
              run.events.map((e, i) => (
                <div
                  key={i}
                  className={`rounded border px-3 py-2 text-xs ${
                    e.level === "error"
                      ? "border-red-500/30 bg-red-500/5 text-red-300"
                      : e.level === "warn"
                        ? "border-amber-500/30 bg-amber-500/5 text-amber-200"
                        : e.level === "success"
                          ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-200"
                          : "border-border bg-muted/40 text-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium uppercase tracking-wide text-[10px]">{e.step}</span>
                    <span className="text-[10px] opacity-60">
                      {new Date(e.ts).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="mt-0.5">{e.action}</div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
