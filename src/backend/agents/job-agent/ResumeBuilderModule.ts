/**
 * modules/resumes/resume_builder.ts
 * =================================
 * Purpose      : Parses + renders the master resume markdown for a given
 *                application (server-side rendering pipeline).
 * Inputs       : Resume markdown + template id.
 * Outputs      : Parsed resume + HTML render.
 * Responsibility: Build/render only — optimization lives in
 *                `resume_optimizer`.
 */
export * from "@backend/resume/ResumeRenderer.server";
