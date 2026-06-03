import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Brain, CheckCircle2, Loader2, Target, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { analyzeJobListing } from "@/lib/imperium/client";

export function JobIntelligencePanel({ listingId }: { listingId: string }) {
  const q = useQuery({
    queryKey: ["brain-job", listingId],
    queryFn: () => analyzeJobListing(listingId),
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (q.isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        Brain analyzing this role…
      </div>
    );
  }
  if (q.error || !q.data) {
    return (
      <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
        Brain could not score this role.
      </div>
    );
  }
  const j = q.data;
  const matchPct = Math.round(j.match_score * 100);
  const recColor =
    j.recommendation === "apply"
      ? "border-success/30 bg-success/10 text-success"
      : j.recommendation === "consider"
        ? "border-warning/30 bg-warning/10 text-warning"
        : "border-destructive/30 bg-destructive/10 text-destructive";
  const riskColor =
    j.risk === "low" ? "text-success" : j.risk === "medium" ? "text-warning" : "text-destructive";

  return (
    <div className="space-y-3 rounded-md border border-primary/20 bg-primary/5 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-primary">
          <Brain className="h-3 w-3" /> Brain Intelligence
        </div>
        <Badge variant="outline" className={recColor}>
          {j.recommendation.toUpperCase()}
        </Badge>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Brain match</span>
          <span className="font-semibold tabular-nums">{matchPct}%</span>
        </div>
        <Progress value={matchPct} className="h-1.5" />
      </div>

      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <Metric label="Required" value={`${Math.round(j.required_match * 100)}%`} />
        <Metric label="Preferred" value={`${Math.round(j.preferred_match * 100)}%`} />
        <Metric label="Interview" value={`${Math.round(j.interview_potential * 100)}%`} />
      </div>

      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1">
          <AlertTriangle className={`h-3 w-3 ${riskColor}`} /> Risk: <span className={riskColor}>{j.risk}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <Target className="h-3 w-3 text-muted-foreground" /> {j.difficulty}
        </span>
        <span className="inline-flex items-center gap-1">
          <TrendingUp className="h-3 w-3 text-muted-foreground" /> conf {Math.round(j.confidence * 100)}%
        </span>
      </div>

      {j.strength_alignment.length > 0 && (
        <div>
          <div className="mb-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Why you fit</div>
          <div className="flex flex-wrap gap-1">
            {j.strength_alignment.slice(0, 5).map((s) => (
              <span key={s} className="inline-flex items-center gap-1 rounded bg-success/10 px-1.5 py-0.5 text-[10px] text-success">
                <CheckCircle2 className="h-2.5 w-2.5" /> {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {j.missing_skills.length > 0 && (
        <div>
          <div className="mb-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Gaps to bridge</div>
          <div className="flex flex-wrap gap-1">
            {j.missing_skills.slice(0, 6).map((s) => (
              <span key={s} className="rounded bg-warning/10 px-1.5 py-0.5 text-[10px] text-warning">− {s}</span>
            ))}
          </div>
        </div>
      )}

      {j.reasoning && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">{j.reasoning}</p>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border/60 bg-background/60 p-1.5 text-center">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xs font-semibold tabular-nums">{value}</div>
    </div>
  );
}
