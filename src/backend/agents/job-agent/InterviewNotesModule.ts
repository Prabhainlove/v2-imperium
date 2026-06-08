/**
 * modules/interviews/interview_notes.ts
 * =====================================
 * Purpose      : Notes attached to an interview row. Notes are stored as
 *                fields on the interview record, so this module is a thin
 *                alias over the tracker's upsert path.
 * Inputs       : Interview id + notes string.
 * Outputs      : Updated interview.
 * Responsibility: Notes write path.
 */
export { upsertInterview as saveInterviewNotes } from "@backend/api/imperium.api";
