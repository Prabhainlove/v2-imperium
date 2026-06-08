import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Activity as ActivityIcon, Pause, Play, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/imperium/page-header";
import { ActivityFeed } from "@/components/imperium/activity-feed";
import { getActivity } from "@/lib/imperium/client";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({
    meta: [
      { title: "Activity Center — Imperium" },
      {
        name: "description",
        content:
          "Real-time agent activity log: every action the Imperium kernel and Job Agent take, with status and timestamps.",
      },
      { property: "og:title", content: "Activity Center — Imperium" },
      { property: "og:description", content: "Live execution log." },
    ],
  }),
  component: ActivityPage,
});

function ActivityPage() {
  const [live, setLive] = useState(true);
  const [taskId, setTaskId] = useState("");

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["activity", { limit: 200, taskId }],
    queryFn: ({ signal }) =>
      getActivity({ limit: 200, task_id: taskId || undefined }, signal),
    refetchInterval: live ? 2000 : false,
    retry: false,
  });

  const entries = data ?? [];

  const counts = useMemo(() => {
    const c = { total: entries.length, success: 0, failed: 0, running: 0 };
    for (const e of entries) {
      const s = (e.status ?? "").toLowerCase();
      if (s === "success" || s === "completed") c.success++;
      else if (s === "failed" || s === "error") c.failed++;
      else if (s === "running" || s === "started" || s === "in_progress") c.running++;
    }
    return c;
  }, [entries]);

  return (
    <div className="page-font-dashboard mx-auto w-full max-w-5xl space-y-5 p-4 md:p-6">
      <PageHeader
        title="Activity Center"
        kanji="活"
        kanjiLabel="Katsudō · 活動 · Action"
        description="Live polling of agent_activity_log. Every backend step is recorded and visible here."
        actions={
          <>
            <Button
              variant={live ? "default" : "outline"}
              size="sm"
              onClick={() => setLive((v) => !v)}
              className={live ? "bg-gradient-primary text-primary-foreground" : ""}
            >
              {live ? (
                <>
                  <Pause className="mr-1.5 h-3.5 w-3.5" /> Pause Live
                </>
              ) : (
                <>
                  <Play className="mr-1.5 h-3.5 w-3.5" /> Resume Live
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw
                className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-3 p-3 md:flex-row md:items-center">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="outline">{counts.total} entries</Badge>
            <Badge className="bg-success/15 text-success border-success/30">
              {counts.success} success
            </Badge>
            {counts.failed > 0 && (
              <Badge className="bg-destructive/15 text-destructive border-destructive/30">
                {counts.failed} failed
              </Badge>
            )}
            {counts.running > 0 && (
              <Badge className="bg-primary/15 text-primary border-primary/30">
                {counts.running} running
              </Badge>
            )}
            {live && (
              <span className="inline-flex items-center gap-1.5 text-xs text-success">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                live
              </span>
            )}
          </div>
          <Input
            placeholder="Filter by task_id (e.g. web-search-…)"
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            className="md:ml-auto md:max-w-sm font-mono text-xs"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ActivityIcon className="h-4 w-4 text-primary" /> Execution Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Loading activity…
            </div>
          ) : error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
              Cannot reach Imperium backend. Activity log is empty until the
              FastAPI server is reachable.
            </div>
          ) : (
            <ActivityFeed
              entries={entries}
              emptyHint={
                taskId
                  ? `No activity for task ${taskId}`
                  : "No activity yet — launch a job search to generate events."
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
