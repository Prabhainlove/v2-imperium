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
} from "@/lib/imperium/resume-render";
export type { CoverLetterFields } from "@/lib/imperium/resume-render";
