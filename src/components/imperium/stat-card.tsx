import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "primary",
  kanji,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  tone?: "primary" | "success" | "warning" | "info" | "accent";
  kanji?: string;
}) {
  const toneCls: Record<typeof tone, string> = {
    primary: "text-[#ff8a66] bg-[rgba(255,107,61,0.10)] ring-1 ring-[rgba(255,107,61,0.25)]",
    success: "text-success bg-success/10 ring-1 ring-success/25",
    warning: "text-warning bg-warning/10 ring-1 ring-warning/25",
    info: "text-info bg-info/10 ring-1 ring-info/25",
    accent: "text-accent bg-accent/10 ring-1 ring-accent/25",
  };
  return (
    <Card className="relative overflow-hidden">
      {kanji && (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-3 -bottom-6 select-none font-[Noto_Serif_JP] text-[6rem] font-extrabold leading-none text-white/[0.04]"
        >
          {kanji}
        </span>
      )}
      <CardContent className="relative flex items-start gap-4 p-5">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-sm", toneCls[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-medium uppercase tracking-[0.32em] text-muted-foreground">
            {label}
          </div>
          <div className="mt-1 imp-h text-3xl tabular-nums text-foreground">{value}</div>
          {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
