import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Check, Loader2, Pause, Play, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/imperium/page-header";

export const Route = createFileRoute("/_authenticated/autopilot")({
  head: () => ({
    meta: [
      { title: "Autopilot — Imperium" },
      { name: "description", content: "Watch the local automation agent apply to jobs live." },
    ],
  }),
  component: AutopilotPage,
});

interface RunRow {
  id: string;
  user_id: string;
  job_url: string;
  job_title: string;
  company: string;
  status: string;
  current_step: string;
  current_action: string;
  current_url: string;
  progress: number;
  screenshot_b64: string | null;
  approval_required: boolean;
  approved: boolean | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

interface EventRow {
  id: number;
  step: string;
  action: string;
  level: string;
  url: string;
  created_at: string;
}

const AGENT_TOKEN_KEY = "imperium.agent_token";

function statusColor(s: string) {
  switch (s) {
    case "submitted":
    case "approved":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "awaiting_approval":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "running":
      return "bg-sky-500/15 text-sky-300 border-sky-500/30";
    case "failed":
    case "rejected":
      return "bg-red-500/15 text-red-300 border-red-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function AutopilotPage() {
  const [run, setRun] = useState<RunRow | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [jobUrl, setJobUrl] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [agentToken, setAgentToken] = useState("local-dev-token");
  const [busy, setBusy] = useState(false);
  const eventScroll = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const stored = typeof window !== "undefined" ? localStorage.getItem(AGENT_TOKEN_KEY) : null;
    if (stored) setAgentToken(stored);
  }, []);

  // Load latest active run for this user
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("automation_runs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (!cancelled && data && data[0]) setRun(data[0] as RunRow);
    };
    load();

    const channel = supabase
      .channel(`runs-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "automation_runs", filter: `user_id=eq.${userId}` },
        (payload) => {
          const next = (payload.new ?? payload.old) as RunRow | undefined;
          if (next) setRun(next);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Load events for current run + subscribe
  useEffect(() => {
    if (!run) {
      setEvents([]);
      return;
    }
    let cancelled = false;
    supabase
      .from("automation_events")
      .select("id,step,action,level,url,created_at")
      .eq("run_id", run.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!cancelled && data) setEvents(data as EventRow[]);
      });

    const channel = supabase
      .channel(`events-${run.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "automation_events", filter: `run_id=eq.${run.id}` },
        (payload) => {
          setEvents((prev) => [...prev, payload.new as EventRow]);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [run?.id]);

  useEffect(() => {
    eventScroll.current?.scrollTo({ top: eventScroll.current.scrollHeight });
  }, [events.length]);

  const queueRun = async () => {
    if (!userId) return;
    if (!jobUrl.trim()) return toast.error("Enter a job URL first");
    setBusy(true);
    if (typeof window !== "undefined") localStorage.setItem(AGENT_TOKEN_KEY, agentToken);

    // Pull a minimal candidate snapshot for the local agent to use
    const { data: profile } = await supabase
      .from("profiles")
      .select("name,email,phone")
      .eq("id", userId)
      .maybeSingle();

    const { error } = await supabase.from("automation_runs").insert({
      user_id: userId,
      job_url: jobUrl.trim(),
      job_title: jobTitle.trim(),
      company: company.trim(),
      status: "queued",
      agent_token: agentToken,
      summary: { candidate: profile ?? {} },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Queued. Make sure the local agent is running.");
    setJobUrl("");
  };

  const approve = async () => {
    if (!run) return;
    await supabase.from("automation_runs").update({ approved: true, status: "approved" }).eq("id", run.id);
    toast.success("Approved — agent will submit.");
  };
  const reject = async () => {
    if (!run) return;
    await supabase.from("automation_runs").update({ approved: false, status: "rejected" }).eq("id", run.id);
    toast.message("Rejected.");
  };
  const cancel = async () => {
    if (!run) return;
    await supabase.from("automation_runs").update({ status: "cancelled" }).eq("id", run.id);
  };

  const screenshot = run?.screenshot_b64 ?? null;
  const isActive = useMemo(
    () => run && ["queued", "running", "awaiting_approval"].includes(run.status),
    [run],
  );

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Autopilot"
        description="Queue a job URL; the local Selenium agent on your machine opens a real Chrome window, fills the form, streams every action live, and pauses for your approval before submitting."
      />

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_180px_180px_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="url">Job URL</Label>
            <Input id="url" placeholder="https://…" value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="title">Role</Label>
            <Input id="title" placeholder="Frontend Engineer" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company">Company</Label>
            <Input id="company" placeholder="Acme" value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="token">Agent token</Label>
            <Input id="token" value={agentToken} onChange={(e) => setAgentToken(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={queueRun} disabled={busy} className="w-full md:w-auto">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Play className="mr-2 h-4 w-4" /> Queue</>}
            </Button>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Agent must be running locally: <code className="rounded bg-muted px-1.5 py-0.5">cd IMPERIUM/local_agent &amp;&amp; python main.py</code>
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Live browser</span>
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
          <div className="relative aspect-video w-full bg-black">
            {screenshot ? (
              <img
                src={`data:image/jpeg;base64,${screenshot}`}
                alt="Live browser"
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                {isActive ? "Waiting for first screenshot from local agent…" : "No active run."}
              </div>
            )}
            {run?.status === "running" && (
              <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-red-500/90 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white">
                <span className="relative inline-flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                </span>
                Live
              </div>
            )}
          </div>
          {run && (
            <div className="space-y-3 border-t border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div>
                  <div className="font-medium">{run.current_step || "—"}</div>
                  <div className="text-xs text-muted-foreground">{run.current_action || ""}</div>
                </div>
                <div className="flex gap-2">
                  {run.status === "awaiting_approval" && (
                    <>
                      <Button size="sm" variant="outline" onClick={reject}>
                        <X className="mr-1 h-3.5 w-3.5" /> Reject
                      </Button>
                      <Button size="sm" onClick={approve}>
                        <Check className="mr-1 h-3.5 w-3.5" /> Approve &amp; submit
                      </Button>
                    </>
                  )}
                  {isActive && run.status !== "awaiting_approval" && (
                    <Button size="sm" variant="ghost" onClick={cancel}>
                      <Pause className="mr-1 h-3.5 w-3.5" /> Cancel
                    </Button>
                  )}
                </div>
              </div>
              <Progress value={run.progress} />
              {run.error && (
                <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {run.error}
                </div>
              )}
            </div>
          )}
        </Card>

        <Card className="flex flex-col">
          <div className="border-b border-border px-4 py-2.5 text-sm font-medium">Step timeline</div>
          <div ref={eventScroll} className="max-h-[480px] flex-1 overflow-y-auto p-3 space-y-2">
            {events.length === 0 ? (
              <div className="p-4 text-xs text-muted-foreground">No events yet.</div>
            ) : (
              events.map((e) => (
                <div
                  key={e.id}
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
                      {new Date(e.created_at).toLocaleTimeString()}
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
