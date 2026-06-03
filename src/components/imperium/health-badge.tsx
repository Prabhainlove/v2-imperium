import { useQuery } from "@tanstack/react-query";
import { Activity, AlertCircle, CheckCircle2 } from "lucide-react";
import { getHealth } from "@/lib/imperium/client";
import { getApiBaseUrl } from "@/lib/imperium/config";
import { cn } from "@/lib/utils";

export function HealthBadge() {
  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => getHealth(signal),
    refetchInterval: 30_000,
    retry: false,
  });

  const base = getApiBaseUrl();
  const ok = !!data && !error;
  const status = isLoading
    ? "Connecting…"
    : ok
      ? `Connected · ${data?.agents_count ?? 0} agents`
      : "Offline";

  const Icon = isLoading ? Activity : ok ? CheckCircle2 : AlertCircle;

  return (
    <div
      className={cn(
        "hidden md:flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs",
        ok
          ? "border-success/30 bg-success/10 text-success"
          : isLoading
            ? "border-border bg-muted/40 text-muted-foreground"
            : "border-destructive/30 bg-destructive/10 text-destructive",
      )}
      title={base}
    >
      <span className="relative inline-flex h-2 w-2">
        <span
          className={cn(
            "absolute inline-flex h-full w-full rounded-full opacity-60",
            ok ? "bg-success animate-ping" : "bg-destructive",
            isFetching && ok ? "" : "",
          )}
        />
        <span
          className={cn(
            "relative inline-flex h-2 w-2 rounded-full",
            ok ? "bg-success" : isLoading ? "bg-muted-foreground" : "bg-destructive",
          )}
        />
      </span>
      <Icon className="h-3.5 w-3.5" />
      <span className="font-medium">{status}</span>
      <span className="hidden lg:inline opacity-60 max-w-[160px] truncate">
        {base}
      </span>
    </div>
  );
}
