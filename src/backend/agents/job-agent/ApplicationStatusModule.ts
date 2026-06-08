/**
 * modules/applications/application_status.ts
 * ==========================================
 * Purpose      : Mutates application status / fields (applied, interview,
 *                rejected, offer, etc.).
 * Inputs       : Application id + new status / fields.
 * Outputs      : Updated DTO.
 * Responsibility: Status writes only.
 */
export {
  updateApplicationStatus,
  updateApplicationFields,
} from "@backend/api/imperium.api";
