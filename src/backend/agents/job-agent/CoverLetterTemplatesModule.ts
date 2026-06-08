/**
 * modules/cover_letters/cover_letter_templates.ts
 * ===============================================
 * Purpose      : Client-side cover letter rendering + PDF export.
 * Inputs       : `CoverLetterFields`.
 * Outputs      : HTML string / downloadable PDF.
 * Responsibility: Presentation only.
 */
export {
  renderCoverLetterHtml,
  downloadCoverLetterPdf,
} from "@backend/resume/ResumeGenerator";
export type { CoverLetterFields } from "@backend/resume/ResumeGenerator";
