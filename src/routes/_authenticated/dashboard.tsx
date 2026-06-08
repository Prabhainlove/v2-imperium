import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity as ActivityIcon,
  AlertCircle,
  Briefcase,
  CalendarClock,
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

import { StatusBadge } from "@/components/imperium/status-badge";
import { MatchScore } from "@/components/imperium/match-score";
import { ExecutionTimeline } from "@/components/imperium/execution-timeline";
import { getDashboard, getApplications, getJobs, getActivity, getCareerIntelligence, getInterviews } from "@/lib/imperium/client";
import { formatRelativeTime } from "@/lib/imperium/format";
import { getApiBaseUrl } from "@/lib/imperium/config";

export const Route = createFileRoute("/_authenticated/dashboard")({
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

  const intelligence = useQuery({
    queryKey: ["career-intelligence"],
    queryFn: () => getCareerIntelligence(),
    retry: false,
    staleTime: 5 * 60_000,
  });

  const interviews = useQuery({
    queryKey: ["interviews", "dashboard"],
    queryFn: () => getInterviews(),
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
        recentApps.filter((a) => a.status === "Interview").length,
      icon: ActivityIcon,
      tone: "warning" as const,
    },
    {
      label: "Offers",
      value:
        metrics.offers ??
        recentApps.filter((a) => a.status === "Offer").length,
      icon: Trophy,
      tone: "success" as const,
    },
  ];

  const showOffline =
    dashboard.isError && jobs.isError && apps.isError;

  return (
    <div className="page-font-dashboard mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <PageHeader
        title="Mission Control"
        kanji="司"
        kanjiLabel="Shirei · 司令 · Command"
        description="Live view of the Imperium AI Job Agent. Every action is logged and visible."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/interviews">
                <CalendarClock className="mr-2 h-4 w-4" /> Interviews
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

      {/* removed dead "backend offline" panel that referenced legacy Python backend */}

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



      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" /> Local Intelligence
            <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
              {intelligence.isFetching ? "Calculating…" : "Live"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Strategy</div>
            <p className="mt-1 text-sm">
              {intelligence.data?.application_strategy ?? (intelligence.isLoading ? "Analyzing your career signals…" : "Run a job search to analyze your trajectory.")}
            </p>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Market Insights</div>
            <ul className="mt-1 space-y-1 text-sm">
              {(intelligence.data?.market_insights ?? []).slice(0, 3).map((m, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-primary">›</span>
                  <span>{m}</span>
                </li>
              ))}
              {(!intelligence.data?.market_insights?.length) && (
                <li className="text-muted-foreground">{intelligence.isLoading ? "…" : "—"}</li>
              )}
            </ul>
          </div>
          {!!intelligence.data?.skill_recommendations?.length && (
            <div className="md:col-span-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Skill Focus</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {intelligence.data.skill_recommendations.slice(0, 8).map((s) => (
                  <span key={s} className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
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
              <CalendarClock className="h-4 w-4 text-primary" /> Upcoming Interviews
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/interviews">
                Open <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {(() => {
              const upcoming = (interviews.data ?? [])
                .filter((i) => i.interview_at && new Date(i.interview_at) >= new Date())
                .slice(0, 6);
              if (upcoming.length === 0) {
                return (
                  <div className="rounded-md border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                    No interviews scheduled. Add one from the Interview Tracker.
                  </div>
                );
              }
              return (
                <ul className="divide-y divide-border/60">
                  {upcoming.map((i) => (
                    <li key={i.id} className="py-2.5">
                      <div className="truncate text-sm font-medium">
                        {i.position || i.stage} <span className="text-muted-foreground">@</span> {i.company}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {new Date(i.interview_at as string).toLocaleString()} · {i.stage}
                      </div>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
