/**
 * modules/applications/application_history.ts
 * ===========================================
 * Purpose      : Timeline + activity log for a single application.
 * Inputs       : Application id.
 * Outputs      : Ordered event list.
 * Responsibility: History reads only.
 */
export {
  getApplicationTimeline,
  getActivity,
} from "@backend/api/imperium.api";
