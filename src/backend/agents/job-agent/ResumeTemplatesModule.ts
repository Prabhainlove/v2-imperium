/**
 * modules/resumes/resume_templates.ts
 * ===================================
 * Purpose      : Client-side resume + cover-letter rendering helpers
 *                (templates, PDF download, readability analysis).
 * Inputs       : Profile / resume markdown.
 * Outputs      : HTML, PDF blobs, keyword stats.
 * Responsibility: Presentation only — safe to import from the browser.
 */
export * from "@/lib/imperium/resume-render";
