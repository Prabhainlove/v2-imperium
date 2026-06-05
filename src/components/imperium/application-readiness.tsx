import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Loader2,
  Send,
  ShieldCheck,
  Target,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { evaluateApplication } from "@/lib/imperium/client";

export function ApplicationReadinessPanel({ applicationId }: { applicationId: string }) {
  const q = useQuery({
    queryKey: ["app-readiness", applicationId],
    queryFn: () => evaluateApplication(applicationId),
    staleTime: 60_000,
    retry: false,
  });

  if (q.isLoading) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" /> Evaluating application readiness locally…
        </CardContent>
      </Card>
    );
  }
  if (q.error || !q.data) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="p-4 text-sm text-destructive">
          Could not evaluate readiness for this application.
        </CardContent>
      </Card>
    );
  }

  const { job_score, ats, readiness } = q.data;
  const recColor =
    readiness.final_recommendation === "submit"
      ? "border-success/40 bg-success/10 text-success"
      : readiness.final_recommendation === "revise"
        ? "border-warning/40 bg-warning/10 text-warning"
        : "border-destructive/40 bg-destructive/10 text-destructive";
  const ringColor =
    readiness.readiness_score >= 70
      ? "stroke-success"
      : readiness.readiness_score >= 50
        ? "stroke-warning"
        : "stroke-destructive";

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" /> Application Readiness
          </span>
          <Badge variant="outline" className={recColor}>
            {readiness.final_recommendation === "submit" ? (
              <Send className="mr-1 h-3 w-3" />
            ) : readiness.final_recommendation === "revise" ? (
              <AlertTriangle className="mr-1 h-3 w-3" />
            ) : (
              <ShieldCheck className="mr-1 h-3 w-3" />
            )}
            {readiness.final_recommendation.toUpperCase()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <ReadinessRing value={readiness.readiness_score} ringColor={ringColor} />
          <div className="grid flex-1 grid-cols-3 gap-2">
            <Metric label="Job Match" value={`${Math.round(job_score.match_score * 100)}%`} />
            <Metric label="ATS Score" value={`${ats.score}%`} />
            <Metric label="Success Prob" value={`${Math.round(readiness.success_probability * 100)}%`} />
          </div>
        </div>

        {readiness.reasoning && (
          <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {readiness.reasoning}
          </p>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-warning">
              <AlertTriangle className="h-3 w-3" /> Risks ({readiness.risks.length})
            </div>
            {readiness.risks.length === 0 ? (
              <p className="text-xs text-success">No blockers detected.</p>
            ) : (
              <ul className="space-y-0.5 text-xs">
                {readiness.risks.map((r, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="text-warning">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-primary">
              <TrendingUp className="h-3 w-3" /> Improvements
            </div>
            {readiness.recommended_improvements.length === 0 ? (
              <p className="text-xs text-success">Package is application-ready.</p>
            ) : (
              <ul className="space-y-0.5 text-xs">
                {readiness.recommended_improvements.map((r, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="text-primary">→</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-2 rounded-md border border-border/60 bg-background/40 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Target className="h-3 w-3" /> ATS keyword coverage
            </span>
            <span className="font-semibold tabular-nums">{ats.score}%</span>
          </div>
          <Progress value={ats.score} className="h-1.5" />
          {ats.matched_keywords.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {ats.matched_keywords.slice(0, 8).map((k) => (
                <span key={k} className="inline-flex items-center gap-1 rounded bg-success/10 px-1.5 py-0.5 text-[10px] text-success">
                  <CheckCircle2 className="h-2.5 w-2.5" /> {k}
                </span>
              ))}
              {ats.missing_keywords.slice(0, 6).map((k) => (
                <span key={k} className="rounded bg-warning/10 px-1.5 py-0.5 text-[10px] text-warning">
                  − {k}
                </span>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ReadinessRing({ value, ringColor }: { value: number; ringColor: string }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const off = c * (1 - value / 100);
  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={r} className="fill-none stroke-muted/40" strokeWidth="6" />
        <circle
          cx="40"
          cy="40"
          r={r}
          className={`fill-none ${ringColor} transition-all`}
          strokeWidth="6"
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold tabular-nums">{value}</span>
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Ready</span>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-background/60 p-2 text-center">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
