/** Live, scaled resume preview. Renders the active template + theme from store state. */
import { useEffect, useRef, useState } from "react";
import { useResumeStore } from "@frontend/resume/state/useResumeStore";
import { getTemplate } from "@frontend/resume/templates/registry";
import { getTheme } from "@frontend/resume/templates/themes";
import { PAPER_PX } from "@frontend/resume/templates/_shared";

export function PreviewPane() {
  const resume = useResumeStore((s) => s.resume);
  const Template = getTemplate(resume.meta.templateId).component;
  const theme = getTheme(resume.meta.themeId);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const compute = () => {
      const el = wrapRef.current;
      if (!el) return;
      const paper = PAPER_PX[resume.meta.paper];
      const avail = el.clientWidth - 48;
      setScale(Math.min(1, avail / paper.w));
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [resume.meta.paper]);

  const paper = PAPER_PX[resume.meta.paper];
  return (
    <div ref={wrapRef} className="resume-preview-wrap">
      <div
        className="resume-preview-canvas"
        style={{
          width: paper.w * scale,
          height: paper.h * scale,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            width: paper.w,
          }}
        >
          <Template resume={resume} theme={theme} />
        </div>
      </div>
      <div className="resume-preview-meta">
        {resume.meta.paper} · {Math.round(scale * 100)}%
      </div>
    </div>
  );
}
