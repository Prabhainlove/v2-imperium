/**
 * Profile Completeness Panel — shows completion %, strength, readiness,
 * and prioritized recommendations. Reusable across /settings and /dashboard.
 */
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { ProfileCompleteness } from "@/lib/imperium/profile/completeness";

export function ProfileCompletenessPanel({
  completeness,
  compact,
}: {
  completeness: ProfileCompleteness;
  compact?: boolean;
}) {
  const pct = Math.round(completeness.completion * 100);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle2 className="h-4 w-4 text-primary" /> Profile Completeness
          <Badge variant="secondary" className="ml-2">{pct}%</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={pct} />
        <div className="grid grid-cols-3 gap-3 text-center">
          <Metric label="Completion" value={`${pct}%`} />
          <Metric label="Strength" value={`${completeness.strength}`} />
          <Metric label="Readiness" value={`${completeness.readiness}`} />
        </div>

        {!compact && completeness.recommendations.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Recommended next steps</div>
            <ul className="space-y-1.5">
              {completeness.recommendations.map((r, i) => (
                <li key={i} className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 p-2 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!compact && (
          <div className="grid grid-cols-2 gap-1.5 text-xs md:grid-cols-3">
            {completeness.categories.map((c) => (
              <div key={c.key} className={`flex items-center gap-2 rounded-md border p-1.5 ${c.passed ? "border-success/30 bg-success/5" : "border-border/60"}`}>
                <span className={`h-2 w-2 rounded-full ${c.passed ? "bg-success" : "bg-muted-foreground/40"}`} />
                <span className="flex-1 truncate">{c.label}</span>
                <span className="text-muted-foreground">{Math.round(c.score * 100)}%</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-card/40 p-2">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
