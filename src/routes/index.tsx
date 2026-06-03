import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity as ActivityIcon,
  AlertCircle,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Search as SearchIcon,
  Send,
  Sparkles,
  Trophy,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/imperium/page-header";
import { StatCard } from "@/components/imperium/stat-card";
import { ActivityFeed } from "@/components/imperium/activity-feed";
import { StatusBadge } from "@/components/imperium/status-badge";
import { MatchScore } from "@/components/imperium/match-score";
import { ExecutionTimeline } from "@/components/imperium/execution-timeline";
import { getDashboard, getApplications, getJobs, getActivity } from "@/lib/imperium/client";
import { formatRelativeTime } from "@/lib/imperium/format";
import { getApiBaseUrl } from "@/lib/imperium/config";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Imperium" },
      {
        name: "description",
        content:
          "Imperium command center: jobs found, applications, interviews, offers and live agent activity.",
      },
      { property: "og:title", content: "Dashboard — Imperium" },
      { property: "og:description", content: "Live AI Job Agent dashboard." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: ({ signal }) => getDashboard(signal),
    refetchInterval: 15_000,
    retry: false,
  });

  const apps = useQuery({
    queryKey: ["applications", { limit: 5 }],
    queryFn: ({ signal }) => getApplications({ limit: 5 }, signal),
    retry: false,
  });

  const jobs = useQuery({
    queryKey: ["jobs", { limit: 5 }],
    queryFn: ({ signal }) => getJobs({ limit: 5 }, signal),
    retry: false,
  });

  const recentActivity = useQuery({
    queryKey: ["activity", { dashboard: true }],
    queryFn: ({ signal }) => getActivity({ limit: 60 }, signal),
    refetchInterval: 4_000,
    retry: false,
  });

  const metrics = (dashboard.data?.metrics ?? {}) as Record<string, number>;
  const recentApps = dashboard.data?.recent_applications ?? apps.data ?? [];
  const activity = dashboard.data?.activity ?? [];

  const stats = [
    {
      label: "Jobs Discovered",
      value:
        metrics.jobs_discovered ??
        metrics.total_jobs ??
        jobs.data?.length ??
        0,
      icon: Briefcase,
      tone: "primary" as const,
    },
    {
      label: "Applications",
      value: metrics.total_applications ?? recentApps.length ?? 0,
      icon: Send,
      tone: "info" as const,
    },
    {
      label: "Interviews",
      value:
        metrics.interviews ??
        recentApps.filter((a) => a.status === "Interview Scheduled").length,
      icon: ActivityIcon,
      tone: "warning" as const,
    },
    {
      label: "Offers",
      value:
        metrics.offers ??
        recentApps.filter((a) => a.status === "Offer Received").length,
      icon: Trophy,
      tone: "success" as const,
    },
  ];

  const showOffline =
    dashboard.isError && jobs.isError && apps.isError;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <PageHeader
        title="Mission Control"
        description="Live view of the Imperium AI Job Agent. Every action is logged and visible."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/activity">
                <ActivityIcon className="mr-2 h-4 w-4" /> Activity
              </Link>
            </Button>
            <Button asChild className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95">
              <Link to="/search">
                <SearchIcon className="mr-2 h-4 w-4" /> Run Job Search
              </Link>
            </Button>
          </>
        }
      />

      {showOffline && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
            <div className="flex-1">
              <div className="font-medium text-destructive">
                Imperium backend is offline
              </div>
              <div className="mt-0.5 text-muted-foreground">
                The frontend is configured to talk to{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  {getApiBaseUrl()}
                </code>
                . Start the FastAPI server (
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  uvicorn main:app --port 8000
                </code>
                ) or change the URL in Settings.
              </div>
              <div className="mt-2">
                <Button asChild size="sm" variant="outline">
                  <Link to="/settings">Open Settings</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ActivityIcon className="h-4 w-4 text-primary" /> Execution Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ExecutionTimeline entries={recentActivity.data ?? []} />
        </CardContent>
      </Card>



      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4 text-primary" /> Recent Applications
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/applications">
                View all <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentApps.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                No applications yet. Start a search to generate application packages.
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {recentApps.slice(0, 6).map((a) => (
                  <li
                    key={a.application_id}
                    className="flex items-center gap-3 py-3"
                  >
                    <MatchScore score={a.match_score} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {a.job_title}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {a.company} · {formatRelativeTime(a.date_applied)}
                      </div>
                    </div>
                    <StatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ActivityIcon className="h-4 w-4 text-primary" /> Live Activity
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/activity">
                Open <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ActivityFeed
              entries={activity.slice(0, 8)}
              dense
              emptyHint="Run a search to populate the activity timeline."
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-accent" /> How Imperium Works
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          {[
            { title: "Discovery", desc: "Scans 6 real job sources in parallel." },
            { title: "Analysis", desc: "Extracts requirements, scores match." },
            { title: "Resume", desc: "ATS-optimized resume per role." },
            { title: "Cover Letter", desc: "Personalized to company & role." },
            { title: "Tracking", desc: "Full lifecycle, recruiter events, alerts." },
          ].map((s, i) => (
            <div
              key={s.title}
              className="rounded-lg border border-border/60 bg-card/40 p-3"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                  {i + 1}
                </span>
                Stage
              </div>
              <div className="mt-1 text-sm font-medium">{s.title}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {s.desc}
              </div>
              <CheckCircle2 className="mt-2 h-3.5 w-3.5 text-success/70" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
