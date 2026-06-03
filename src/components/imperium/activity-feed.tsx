import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityLogEntry } from "@/lib/imperium/types";
import { formatRelativeTime, formatTime, humanizeAction } from "@/lib/imperium/format";

function statusIcon(s?: string | null) {
  switch ((s ?? "").toLowerCase()) {
    case "success":
    case "completed":
    case "complete":
      return { Icon: CheckCircle2, cls: "text-success" };
    case "failed":
    case "error":
      return { Icon: XCircle, cls: "text-destructive" };
    case "warning":
    case "warn":
      return { Icon: AlertCircle, cls: "text-warning" };
    case "running":
    case "in_progress":
    case "started":
      return { Icon: Loader2, cls: "text-primary animate-spin" };
    default:
      return { Icon: Circle, cls: "text-muted-foreground" };
  }
}

export function ActivityFeed({
  entries,
  emptyHint,
  dense = false,
  showRelative = true,
}: {
  entries: ActivityLogEntry[];
  emptyHint?: string;
  dense?: boolean;
  showRelative?: boolean;
}) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center text-sm text-muted-foreground">
        <Circle className="mb-2 h-5 w-5 opacity-40" />
        {emptyHint ?? "No activity yet. Start a job search to see live progress."}
      </div>
    );
  }

  return (
    <ol className="relative space-y-0.5">
      {entries.map((e, idx) => {
        const { Icon, cls } = statusIcon(e.status);
        const last = idx === entries.length - 1;
        return (
          <li key={e.log_id} className="relative flex gap-3 pl-2">
            <div className="relative flex w-6 flex-col items-center">
              <Icon className={cn("h-4 w-4 shrink-0 mt-1", cls)} />
              {!last && (
                <span className="absolute top-6 bottom-[-4px] w-px bg-border/60" />
              )}
            </div>
            <div
              className={cn(
                "flex-1 rounded-md border border-transparent px-2 transition-colors hover:bg-muted/40",
                dense ? "py-1" : "py-2",
              )}
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-sm font-medium text-foreground">
                  {humanizeAction(e.action)}
                </span>
                {e.agent && (
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {e.agent}
                  </span>
                )}
                <span
                  className="ml-auto text-xs text-muted-foreground tabular-nums"
                  title={e.created_at}
                >
                  {showRelative ? formatRelativeTime(e.created_at) : formatTime(e.created_at)}
                </span>
              </div>
              {e.detail && (
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                  {e.detail}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
