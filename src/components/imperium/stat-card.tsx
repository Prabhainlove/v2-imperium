import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "primary",
  // legacy prop, no-op
  kanji: _kanji,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  tone?: "primary" | "success" | "warning" | "info" | "accent";
  kanji?: string;
}) {
  const toneCls: Record<typeof tone, string> = {
    primary: "text-primary bg-primary/10 ring-1 ring-primary/20",
    success: "text-success bg-success/10 ring-1 ring-success/20",
    warning: "text-warning bg-warning/10 ring-1 ring-warning/20",
    info: "text-info bg-info/10 ring-1 ring-info/20",
    accent: "text-accent bg-accent/10 ring-1 ring-accent/20",
  };
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="relative flex items-start gap-4 p-5">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", toneCls[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </div>
          <div className="mt-1 imp-h text-3xl tabular-nums text-foreground">{value}</div>
          {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
