import { cn } from "@/lib/utils";
import { scoreToPercent, scoreTone } from "@/lib/imperium/format";

export function MatchScore({
  score,
  size = "md",
  className,
}: {
  score?: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const pct = scoreToPercent(score);
  const tone = scoreTone(score);
  const ringColor =
    tone === "high"
      ? "text-success"
      : tone === "mid"
        ? "text-warning"
        : "text-muted-foreground";

  const dim = size === "sm" ? 40 : size === "lg" ? 72 : 56;
  const stroke = size === "sm" ? 4 : size === "lg" ? 7 : 5;
  const r = (dim - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  const fontClass =
    size === "sm" ? "text-[10px]" : size === "lg" ? "text-lg" : "text-sm";

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: dim, height: dim }}
      aria-label={`Match score ${pct}%`}
    >
      <svg width={dim} height={dim} className="-rotate-90">
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={r}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="none"
          className="text-muted/40"
        />
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={r}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className={cn("transition-all", ringColor)}
        />
      </svg>
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center font-semibold tabular-nums",
          fontClass,
          ringColor,
        )}
      >
        {pct}%
      </span>
    </div>
  );
}
