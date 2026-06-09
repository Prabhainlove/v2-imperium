/**
 * PDF Export — html2pdf against the Print Renderer (NOT the scaled preview).
 * Includes a layout validator that surfaces orphan headings / overflow risk.
 */
import type { ResumeJSON } from "@frontend/resume/schema";

export interface PrintValidation {
  warnings: string[];
  estimatedPages: number;
  overflow: boolean;
}

export function validatePrintLayout(node: HTMLElement, resume: ResumeJSON): PrintValidation {
  const warnings: string[] = [];
  const paperH = resume.meta.paper === "A4" ? 1123 : 1056;
  const contentH = node.scrollHeight;
  const estimatedPages = Math.max(1, Math.ceil(contentH / paperH));

  // Orphan heading check: section header within last 60px of a page break.
  const headings = Array.from(node.querySelectorAll("h1, h2, h3"));
  for (const h of headings) {
    const top = (h as HTMLElement).offsetTop;
    const remainder = top % paperH;
    if (remainder > paperH - 60) {
      warnings.push(`Section "${h.textContent?.slice(0, 40)}" may render orphaned near a page break.`);
    }
  }

  if (estimatedPages > 2) warnings.push(`Resume estimated at ${estimatedPages} pages — consider trimming.`);

  const overflow = contentH > paperH * 3; // hard overflow alert
  if (overflow) warnings.push("Content significantly exceeds page area — review for clipping.");

  return { warnings, estimatedPages, overflow };
}

export async function exportResumeToPdf(node: HTMLElement, resume: ResumeJSON): Promise<void> {
  const mod = await import("html2pdf.js");
  const html2pdf = (mod as { default: (...args: unknown[]) => unknown }).default;
  const filename = `${resume.personal.name || "resume"}-${resume.meta.templateId}.pdf`
    .toLowerCase()
    .replace(/\s+/g, "-");

  // A4 mm: 210 x 297; Letter in: 8.5 x 11
  const format = resume.meta.paper === "A4" ? "a4" : "letter";
  const unit = resume.meta.paper === "A4" ? "mm" : "in";

  const opts = {
    margin: 0,
    filename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      windowWidth: node.scrollWidth,
    },
    jsPDF: { unit, format, orientation: "portrait" },
    pagebreak: { mode: ["css", "legacy"] },
  };

  await (html2pdf as (n: HTMLElement) => {
    set: (o: unknown) => { save: () => Promise<void> };
  })(node).set(opts).save();
}
