import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Briefcase,
  ExternalLink,
  FileUp,
  Globe,
  Loader2,
  MapPin,
  Send,
  Settings as SettingsIcon,
  Sparkles,
  Square,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/imperium/page-header";
import { ActivityFeed } from "@/components/imperium/activity-feed";
import {
  SourceMonitor,
  type SourceStatus,
} from "@/components/imperium/source-monitor";
import { MatchScore } from "@/components/imperium/match-score";
import {
  getActivity,
  getProfile,
  runJobSearch,
} from "@/lib/imperium/client";
import { REAL_SOURCES, type SourceId } from "@/lib/imperium/config";
import type { SearchResponse } from "@/lib/imperium/types";
import { useWorkflowAutopilot } from "@/hooks/use-workflow-autopilot";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({
    meta: [
      { title: "Job Agent Control Center — Imperium" },
      {
        name: "description",
        content:
          "Launch an Imperium job search and watch every source, every match, every action in real time.",
      },
      { property: "og:title", content: "Job Agent Control Center — Imperium" },
      {
        property: "og:description",
        content: "Transparent live job search across 6 sources.",
      },
    ],
  }),
  component: SearchPage,
});

const STAGES = [
  { key: "discovery", label: "Discovery" },
  { key: "dedupe", label: "Deduplication" },
  { key: "ranking", label: "Ranking" },
  { key: "analysis", label: "Analysis" },
  { key: "resume", label: "Resume Generation" },
  { key: "cover_letter", label: "Cover Letter" },
  { key: "package", label: "Application Package" },
  { key: "complete", label: "Complete" },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

function inferSourceFromText(text?: string | null): SourceId | null {
  if (!text) return null;
  const t = text.toLowerCase();
  for (const src of REAL_SOURCES) {
    if (t.includes(src.id) || t.includes(src.label.toLowerCase())) return src.id;
  }
  return null;
}

function inferStageFromAction(action: string): StageKey | null {
  const a = action.toLowerCase();
  if (a.includes("discover")) return "discovery";
  if (a.includes("dedup")) return "dedupe";
  if (a.includes("rank") || a.includes("match")) return "ranking";
  if (a.includes("analy")) return "analysis";
  if (a.includes("resume")) return "resume";
  if (a.includes("cover")) return "cover_letter";
  if (a.includes("package") || a.includes("prepar")) return "package";
  if (a.includes("complete") || a.includes("finish")) return "complete";
  return null;
}

function SearchPage() {
  const queryClient = useQueryClient();

  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: ({ signal }) => getProfile(signal),
    retry: false,
  });

  const [role, setRole] = useState("AI Engineer");
  const [location, setLocation] = useState("Germany");
  const [experience, setExperience] = useState("3 years");
  const [skills, setSkills] = useState("Python, PyTorch, LLMs, FastAPI");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [maxApplications, setMaxApplications] = useState(8);
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  // Prefill from saved profile when it loads
  useEffect(() => {
    const p = profile.data?.profile;
    if (!p) return;
    if (!name && p.name) setName(p.name);
    if (!email && p.email) setEmail(p.email);
    if (!phone && p.phone) setPhone(p.phone);
    if (!location && p.location) setLocation(p.location);
    if (!skills && p.skills?.length) setSkills(p.skills.join(", "));
    if (!role && p.target_roles?.[0]) setRole(p.target_roles[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.data]);

  const [result, setResult] = useState<SearchResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Poll activity while running (no task_id yet — pull recent)
  const activity = useQuery({
    queryKey: ["activity", { live: running, taskId }],
    queryFn: ({ signal }) =>
      getActivity({ limit: 100, task_id: taskId ?? undefined }, signal),
    refetchInterval: running ? 1500 : false,
    enabled: running || !!result,
    retry: false,
  });

  // Filter to only entries since search started
  const liveEntries = useMemo(() => {
    if (!activity.data) return [];
    if (!startedAt) return activity.data.slice(0, 30);
    return activity.data.filter(
      (e) => new Date(e.created_at).getTime() >= startedAt - 5000,
    );
  }, [activity.data, startedAt]);

  // Derive source status + stage from activity log
  const sourceStatuses = useMemo<Partial<Record<SourceId, SourceStatus>>>(() => {
    const map: Partial<Record<SourceId, SourceStatus>> = {};
    if (running) {
      for (const s of REAL_SOURCES) map[s.id] = { state: "searching" };
    }
    for (const e of liveEntries) {
      const src =
        inferSourceFromText(e.action) ?? inferSourceFromText(e.detail);
      if (!src) continue;
      const status = (e.status ?? "").toLowerCase();
      if (status === "failed" || status === "error") {
        map[src] = { state: "error", detail: e.detail ?? undefined };
      } else if (status === "success" || status === "completed") {
        const m = e.detail?.match(/(\d+)/);
        map[src] = {
          state: "done",
          count: m ? Number(m[1]) : undefined,
        };
      } else {
        map[src] = { state: "searching" };
      }
    }
    if (result?.summary) {
      // search done — leave statuses as-is but ensure all marked done
      for (const s of REAL_SOURCES) {
        if (!map[s.id] || map[s.id]?.state === "searching") {
          map[s.id] = { state: "done", count: map[s.id]?.count };
        }
      }
    }
    return map;
  }, [liveEntries, running, result]);

  const currentStage = useMemo<StageKey | null>(() => {
    if (result) return "complete";
    let latest: StageKey | null = null;
    for (const e of liveEntries) {
      const s = inferStageFromAction(e.action);
      if (s) latest = s;
    }
    return latest ?? (running ? "discovery" : null);
  }, [liveEntries, running, result]);

  const stageIndex = currentStage
    ? STAGES.findIndex((s) => s.key === currentStage)
    : -1;
  const stageProgress = stageIndex >= 0 ? ((stageIndex + 1) / STAGES.length) * 100 : 0;

  const mutation = useMutation({
    mutationFn: async () => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      return runJobSearch(
        {
          role,
          location,
          resume: resumeFile,
          name: name || undefined,
          email: email || undefined,
          phone: phone || undefined,
          skills,
          experience,
          company: company || undefined,
          application_mode: "manual",
          max_applications: maxApplications,
        },
        ctrl.signal,
      );
    },
    onMutate: () => {
      setResult(null);
      setRunning(true);
      setStartedAt(Date.now());
      setTaskId(null);
    },
    onSuccess: (data) => {
      setResult(data);
      setTaskId(data.task_id);
      toast.success(
        `Search complete · ${data.summary?.jobs_found ?? 0} jobs · ${
          data.summary?.qualified_matches ?? 0
        } matches`,
      );
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
    onSettled: () => {
      setRunning(false);
      abortRef.current = null;
    },
  });

  // Autopilot: jump to /applications when the pipeline reaches the review stage.
  useWorkflowAutopilot({
    entries: activity.data,
    enabled: !!result || running,
    reviewPath: "/applications",
  });

  function cancel() {
    abortRef.current?.abort();
    setRunning(false);
    toast.message("Search cancelled");
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!role.trim() || !location.trim()) {
      toast.error("Role and location are required");
      return;
    }
    mutation.mutate();
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <PageHeader
        title="Job Agent Control Center"
        description="Configure the run, then watch Imperium scan, score, and prepare application packages live."
      />

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        {/* LEFT — form */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-accent" /> Mission Parameters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label htmlFor="role">Target Role *</Label>
                  <div className="relative mt-1">
                    <Briefcase className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="role"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="AI Engineer"
                      className="pl-8"
                      required
                    />
                  </div>
                </div>

                <div className="col-span-2">
                  <Label htmlFor="loc">Location *</Label>
                  <div className="relative mt-1">
                    <MapPin className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="loc"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Germany"
                      className="pl-8"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="exp">Experience</Label>
                  <Input
                    id="exp"
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    placeholder="3 years"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="max">Max Applications</Label>
                  <Input
                    id="max"
                    type="number"
                    min={1}
                    max={50}
                    value={maxApplications}
                    onChange={(e) => setMaxApplications(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="skills">Skills (comma-separated)</Label>
                  <Textarea
                    id="skills"
                    value={skills}
                    onChange={(e) => setSkills(e.target.value)}
                    rows={2}
                    placeholder="Python, PyTorch, LLMs"
                    className="mt-1 resize-none"
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label htmlFor="name">Your Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane@example.com"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+49 …"
                    className="mt-1"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="company">Target Company (optional)</Label>
                  <Input
                    id="company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Any"
                    className="mt-1"
                  />
                </div>
              </div>

              <Separator />

              <div>
                <Label>Resume (PDF / DOCX / TXT)</Label>
                <label
                  htmlFor="resume"
                  className="mt-1 flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-border/70 bg-muted/30 p-3 hover:bg-muted/50"
                >
                  <FileUp className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1 text-sm">
                    {resumeFile ? (
                      <>
                        <div className="truncate font-medium">
                          {resumeFile.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {(resumeFile.size / 1024).toFixed(1)} KB
                        </div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">
                        Click to upload or skip to use saved profile
                      </span>
                    )}
                  </div>
                  {resumeFile && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setResumeFile(null);
                      }}
                      className="rounded p-1 text-muted-foreground hover:bg-background"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <input
                    id="resume"
                    type="file"
                    accept=".pdf,.docx,.doc,.txt,.md"
                    className="hidden"
                    onChange={(e) =>
                      setResumeFile(e.target.files?.[0] ?? null)
                    }
                  />
                </label>
              </div>

              <div className="flex gap-2 pt-1">
                {!running ? (
                  <Button
                    type="submit"
                    className="flex-1 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95"
                    disabled={mutation.isPending}
                  >
                    {mutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="mr-2 h-4 w-4" />
                    )}
                    Launch Job Agent
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={cancel}
                    className="flex-1"
                  >
                    <Square className="mr-2 h-4 w-4" /> Cancel
                  </Button>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground">
                application_mode = manual · no real submissions are sent
              </p>
            </form>
          </CardContent>
        </Card>

        {/* RIGHT — live execution */}
        <div className="space-y-4">
          {/* Stage progress */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {result
                    ? "Execution Complete"
                    : running
                      ? "Execution in Progress"
                      : "Awaiting Launch"}
                </CardTitle>
                {result?.task_id && (
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {result.task_id}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={stageProgress} className="h-2" />
              <div className="flex flex-wrap gap-1.5">
                {STAGES.map((s, i) => {
                  const reached = stageIndex >= i;
                  const active = currentStage === s.key && running;
                  return (
                    <span
                      key={s.key}
                      className={`rounded-full border px-2 py-0.5 text-[11px] ${
                        active
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : reached
                            ? "border-success/30 bg-success/10 text-success"
                            : "border-border bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      {s.label}
                    </span>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Source monitor */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="h-4 w-4 text-primary" /> Source Scanner
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SourceMonitor statuses={sourceStatuses} />
            </CardContent>
          </Card>

          {/* Live metrics + activity */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Pipeline Metrics</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <Metric
                  label="Jobs Retrieved"
                  value={result?.summary?.jobs_found ?? "—"}
                />
                <Metric
                  label="Qualified Matches"
                  value={result?.summary?.qualified_matches ?? "—"}
                />
                <Metric
                  label="App Packages"
                  value={result?.summary?.application_packages ?? "—"}
                />
                <Metric
                  label="Duration"
                  value={
                    result?.summary?.duration_seconds
                      ? `${result.summary.duration_seconds.toFixed(1)}s`
                      : "—"
                  }
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Live Log</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-72 overflow-y-auto pr-1">
                  <ActivityFeed
                    entries={liveEntries.slice(0, 25)}
                    dense
                    showRelative={false}
                    emptyHint="Press Launch to begin."
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results */}
          {result && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  Top Matches · {result.matches?.length ?? 0}
                </CardTitle>
                <Button asChild variant="outline" size="sm">
                  <Link to="/applications">
                    <Send className="mr-1.5 h-3.5 w-3.5" /> Track Applications
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {(result.matches ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No qualified matches. Try broadening the role or location.
                  </p>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {result.matches!.slice(0, 8).map((m) => (
                      <li
                        key={m.listing_id}
                        className="flex items-start gap-3 py-3"
                      >
                        <MatchScore score={m.match_score} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="truncate text-sm font-medium">
                              {m.title}
                            </span>
                            <Badge variant="secondary" className="text-[10px]">
                              {m.source}
                            </Badge>
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {m.company}
                            {m.location ? ` · ${m.location}` : ""}
                          </div>
                          {(m.matched_skills?.length ?? 0) > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {m.matched_skills!.slice(0, 6).map((s) => (
                                <span
                                  key={s}
                                  className="rounded bg-success/10 px-1.5 py-0.5 text-[10px] text-success"
                                >
                                  {s}
                                </span>
                              ))}
                              {(m.missing_skills ?? [])
                                .slice(0, 3)
                                .map((s) => (
                                  <span
                                    key={s}
                                    className="rounded bg-warning/10 px-1.5 py-0.5 text-[10px] text-warning"
                                  >
                                    − {s}
                                  </span>
                                ))}
                            </div>
                          )}
                        </div>
                        {m.url && (
                          <Button asChild variant="ghost" size="sm">
                            <a
                              href={m.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          {!profile.data?.profile && !profile.isLoading && (
            <Card className="border-info/30 bg-info/5">
              <CardContent className="flex items-center gap-3 p-3 text-sm">
                <SettingsIcon className="h-4 w-4 text-info" />
                <span className="flex-1 text-muted-foreground">
                  No saved profile yet. Save one in{" "}
                  <Link to="/resume" className="text-info hover:underline">
                    Resume Studio
                  </Link>{" "}
                  for richer matching.
                </span>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border/60 bg-card/50 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
