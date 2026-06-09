/**
 * Print Renderer — renders the active template into an off-screen, full-size
 * (unscaled) container suitable for html2pdf. Never exports from the visible,
 * CSS-scaled preview. Mounted via a portal-like hidden div in document.body.
 */
import { useEffect, useRef } from "react";
import type { ResumeJSON } from "@frontend/resume/schema";
import { getTemplate } from "@frontend/resume/templates/registry";
import { getTheme } from "@frontend/resume/templates/themes";
import { PAPER_PX } from "@frontend/resume/templates/_shared";

export interface PrintHandle {
  /** The DOM node to feed into html2pdf. */
  node: HTMLDivElement;
}

interface PrintRendererProps {
  resume: ResumeJSON;
  registerHandle?: (h: PrintHandle | null) => void;
}

/** Hidden, full-size template render. Use for PDF export only. */
export function PrintRenderer({ resume, registerHandle }: PrintRendererProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const Template = getTemplate(resume.meta.templateId).component;
  const theme = getTheme(resume.meta.themeId);
  const paper = PAPER_PX[resume.meta.paper];

  useEffect(() => {
    if (ref.current) registerHandle?.({ node: ref.current });
    return () => registerHandle?.(null);
  }, [registerHandle]);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: -99999,
        width: paper.w,
        minHeight: paper.h,
        background: "#fff",
        pointerEvents: "none",
      }}
    >
      <div ref={ref} id="resume-print-root" className="resume-print-root">
        <Template resume={resume} theme={theme} />
      </div>
    </div>
  );
}
