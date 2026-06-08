/**
 * modules/interviews/interview_tracker.ts
 * =======================================
 * Purpose      : CRUD for interview records linked to an application.
 * Inputs       : User id + interview payload.
 * Outputs      : Interview DTOs.
 * Responsibility: Persistence only.
 */
export {
  upsertInterview,
  getInterviews,
  deleteInterview,
} from "@backend/api/imperium.api";
