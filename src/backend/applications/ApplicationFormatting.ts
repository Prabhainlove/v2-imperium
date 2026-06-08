/** Small formatting helpers used across Imperium views. */
import type { ApplicationStatus } from "@backend/ai/AiTypes";

export function formatRelativeTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export function formatTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

export function formatSalary(
  min?: number | null,
  max?: number | null,
  currency?: string | null,
): string {
  if (!min && !max) return "—";
  const c = currency ?? "USD";
  const fmt = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`);
  if (min && max) return `${c} ${fmt(min)}–${fmt(max)}`;
  if (min) return `${c} ${fmt(min)}+`;
  return `${c} up to ${fmt(max ?? 0)}`;
}

export function scoreToPercent(score?: number | null): number {
  if (score == null) return 0;
  if (score > 1) return Math.round(score);
  return Math.round(score * 100);
}

export function scoreTone(score?: number | null): "high" | "mid" | "low" {
  const p = scoreToPercent(score);
  if (p >= 80) return "high";
  if (p >= 60) return "mid";
  return "low";
}

export const APPLICATION_STATUS_ORDER: ApplicationStatus[] = [
  "Saved",
  "Preparing",
  "Applied",
  "Assessment",
  "Interview",
  "Offer",
  "Rejected",
  "Withdrawn",
];

export function statusTone(
  status: string,
): "info" | "success" | "warning" | "destructive" | "muted" | "primary" {
  switch (status) {
    case "Saved":
      return "muted";
    case "Preparing":
      return "warning";
    case "Applied":
      return "info";
    case "Assessment":
      return "primary";
    case "Interview":
      return "warning";
    case "Offer":
      return "success";
    case "Rejected":
      return "destructive";
    case "Withdrawn":
      return "muted";
    default:
      return "muted";
  }
}

export function humanizeAction(action: string): string {
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
