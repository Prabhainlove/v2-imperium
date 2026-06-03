import { CheckCircle2, Globe, KeyRound, Loader2, XCircle, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { REAL_SOURCES, type SourceId } from "@/lib/imperium/config";

export type SourceState = "idle" | "searching" | "done" | "error" | "skipped";

export interface SourceStatus {
  state: SourceState;
  count?: number;
  detail?: string;
}

const stateMeta: Record<SourceState, { label: string; cls: string; Icon: typeof Globe }> = {
  idle:      { label: "Idle",          cls: "text-muted-foreground", Icon: Globe },
  searching: { label: "Searching…",    cls: "text-primary",          Icon: Loader2 },
  done:      { label: "Done",          cls: "text-success",          Icon: CheckCircle2 },
  error:     { label: "Failed",        cls: "text-destructive",      Icon: XCircle },
  skipped:   { label: "Unavailable",   cls: "text-muted-foreground", Icon: AlertCircle },
};

export function SourceMonitor({
  statuses,
}: {
  statuses: Partial<Record<SourceId, SourceStatus>>;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
      {REAL_SOURCES.map((src) => {
        const s = statuses[src.id] ?? { state: "idle" as SourceState };
        const meta = stateMeta[s.state];
        const animated = s.state === "searching";
        return (
          <Card
            key={src.id}
            className={cn(
              "relative overflow-hidden border-border/60 transition-all",
              animated && "ring-1 ring-primary/40 shadow-glow",
              s.state === "skipped" && "opacity-70",
            )}
          >
            {animated && (
              <span className="pointer-events-none absolute inset-x-0 top-0 h-px scanline" />
            )}
            <CardContent className="flex items-center gap-3 p-3">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-md bg-muted/50",
                  meta.cls,
                )}
              >
                <meta.Icon className={cn("h-4 w-4", animated && "animate-spin")} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium">{src.label}</span>
                  {src.requiresKey && (
                    <KeyRound
                      className="h-3 w-3 text-muted-foreground"
                      aria-label="Requires API key"
                    />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs", meta.cls)}>
                    {s.state === "skipped" && s.detail
                      ? "Needs API key"
                      : meta.label}
                  </span>
                  {typeof s.count === "number" && s.state === "done" && (
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                      {s.count}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
