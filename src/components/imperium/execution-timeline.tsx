import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/imperium/format";
import type { ActivityLogEntry } from "@/lib/imperium/types";

/**
 * Unified execution timeline. Maps the agent's discrete actions onto a fixed
 * vertical stage list so the reviewer always sees the full pipeline shape,
 * even between events.
 */
const STAGES: { key: string; label: string; matches: RegExp }[] = [
  { key: "search_started",        label: "Search Started",        matches: /search_started|plan/ },
  { key: "jobs_retrieved",        label: "Jobs Retrieved",        matches: /jobs_retrieved|discover_/ },
  { key: "jobs_ranked",           label: "Jobs Ranked",           matches: /jobs_ranked|rank|score/ },
  { key: "generate_resume",       label: "Resume Generated",      matches: /generate_resume/ },
  { key: "generate_cover_letter", label: "Cover Letter Generated",matches: /generate_cover_letter/ },
  { key: "prepare_application",   label: "Application Prepared",  matches: /prepare_application/ },
  { key: "user_review",           label: "User Review",           matches: /user_review|user_skip/ },
  { key: "application_submitted", label: "Application Submitted", matches: /application_submitted|fill_review_complete/ },
];

type StageState = "pending" | "running" | "done";

export function ExecutionTimeline({
  entries,
  className,
}: {
  entries: ActivityLogEntry[];
  className?: string;
}) {
  const stageState = STAGES.map((s) => {
    let state: StageState = "pending";
    let lastTs: string | undefined;
    for (const e of entries) {
      if (!s.matches.test(e.action)) continue;
      const st = (e.status ?? "").toLowerCase();
      if (st === "running") {
        if (state !== "done") state = "running";
      } else if (st === "success" || st === "completed" || st === "ok") {
        state = "done";
      }
      lastTs = e.created_at;
    }
    return { ...s, state, lastTs };
  });

  return (
    <ol className={cn("relative space-y-0", className)}>
      {stageState.map((s, idx) => {
        const Icon =
          s.state === "done"
            ? CheckCircle2
            : s.state === "running"
              ? Loader2
              : Circle;
        const iconCls =
          s.state === "done"
            ? "text-success"
            : s.state === "running"
              ? "text-primary animate-spin"
              : "text-muted-foreground/50";
        const last = idx === stageState.length - 1;
        return (
          <li key={s.key} className="relative flex gap-3 pl-1">
            <div className="relative flex w-6 flex-col items-center">
              <Icon className={cn("mt-1 h-4 w-4 shrink-0", iconCls)} />
              {!last && <span className="absolute top-6 bottom-[-4px] w-px bg-border/60" />}
            </div>
            <div className="flex-1 py-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={cn(
                    "text-sm font-medium",
                    s.state === "pending" ? "text-muted-foreground/70" : "text-foreground",
                  )}
                >
                  {s.label}
                </span>
                {s.lastTs && (
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {formatRelativeTime(s.lastTs)}
                  </span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
