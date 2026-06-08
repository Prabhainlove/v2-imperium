/**
 * modules/cover_letters/cover_letter_builder.ts
 * =============================================
 * Purpose      : Generates a tailored cover letter for a job + profile.
 * Inputs       : Job, profile, optional tone hints.
 * Outputs      : `CoverLetterPackage` (markdown + alignment notes).
 * Responsibility: Generation only — presentation templates live alongside.
 */
export * from "@backend/ai/cover-letter-writer/CoverLetterWriter.server";
