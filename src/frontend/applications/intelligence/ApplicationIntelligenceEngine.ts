/**
 * Application Intelligence Engine — pure TypeScript.
 * Computes age, staleness, response probability, and next recommended
 * action from application data. Deterministic and side-effect free.
 */
import type {
  Application,
  ApplicationIntelligence,
  ApplicationStatus,
} from "../schema";

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_THRESHOLD_DAYS = 21;

export function computeAgeDays(appliedAt: string, now: number = Date.now()): number {
  const t = Date.parse(appliedAt);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((now - t) / DAY_MS));
}

export function isStale(status: ApplicationStatus, ageDays: number): boolean {
  return ageDays > STALE_THRESHOLD_DAYS && (status === "applied" || status === "viewed");
}

export function responseProbability(app: Application, ageDays: number): number {
  if (app.status === "offer") return 1;
  if (app.status === "rejected" || app.status === "withdrawn") return 0;
  if (app.status === "interview" || app.status === "assessment") return 0.85;
  if (app.status === "under_review") return 0.6;
  if (app.status === "viewed") return 0.35;

  // applied: blend ATS + match + age decay
  const ats = (app.atsScore ?? 70) / 100;
  const match = (app.matchScore ?? 60) / 100;
  const base = 0.4 * ats + 0.4 * match + 0.2;
  // Decay: full strength for 7d, then linear to 0 by 30d
  const decay = ageDays <= 7 ? 1 : Math.max(0, 1 - (ageDays - 7) / 23);
  return Math.max(0.05, Math.min(0.95, base * decay));
}

export function nextRecommendedAction(
  status: ApplicationStatus,
  ageDays: number,
): string {
  switch (status) {
    case "offer":
      return "Active negotiation";
    case "rejected":
      return "Closed — request feedback";
    case "withdrawn":
      return "Closed";
    case "interview":
      return "Prepare interview brief";
    case "assessment":
      return "Complete assessment";
    case "under_review":
      return "Stay responsive — recruiter is reviewing";
    case "viewed":
    case "applied":
    default:
      if (ageDays < 7) return "Wait for response";
      if (ageDays <= 14) return "Send polite follow-up";
      if (ageDays <= 21) return "Send second follow-up";
      return "Follow up or move on";
  }
}

export function computeIntelligence(
  app: Application,
  now: number = Date.now(),
): ApplicationIntelligence {
  const ageDays = computeAgeDays(app.appliedAt, now);
  return {
    ageDays,
    stale: isStale(app.status, ageDays),
    responseProbability: responseProbability(app, ageDays),
    nextRecommendedAction: nextRecommendedAction(app.status, ageDays),
  };
}

export function withIntelligence(app: Application, now: number = Date.now()): Application {
  return { ...app, intelligence: computeIntelligence(app, now) };
}
