/**
 * modules/applications/application_tracker.ts
 * ===========================================
 * Purpose      : Read/write the list of applications the agent is working on.
 * Inputs       : User id + application ids.
 * Outputs      : Application DTOs for the UI.
 * Responsibility: CRUD only — readiness scoring lives in `planner.ts`.
 */
export {
  getApplications,
  getApplication,
  approveApplication,
  skipApplicationFn,
  evaluateApplication,
} from "@/lib/imperium/server.functions";
