/** Live, scaled resume preview with zoom + device controls. */
import { useEffect, useRef, useState } from "react";
import { useResumeStore } from "@frontend/resume/state/useResumeStore";
import { getTemplate } from "@frontend/resume/templates/registry";
import { getTheme } from "@frontend/resume/templates/themes";
import { PAPER_PX } from "@frontend/resume/templates/_shared";

type ZoomMode = "fit" | "manual";
type Device = "desktop" | "mobile";

export function PreviewPane() {
  const resume = useResumeStore((s) => s.resume);
  const Template = getTemplate(resume.meta.templateId).component;
  const theme = getTheme(resume.meta.themeId);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [device, setDevice] = useState<Device>("desktop");
  const [mode, setMode] = useState<ZoomMode>("fit");
  const [manualScale, setManualScale] = useState(1);
  const [fitScale, setFitScale] = useState(1);

  const paper = PAPER_PX[resume.meta.paper];

  useEffect(() => {
    const compute = () => {
      const el = wrapRef.current;
      if (!el) return;
      const avail = el.clientWidth - 48;
      const targetWidth = device === "mobile" ? Math.min(paper.w, 420) : paper.w;
      setFitScale(Math.min(1, avail / targetWidth));
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [paper.w, device]);

  const scale = mode === "fit" ? fitScale : manualScale;
  const displayPercent = Math.round(scale * 100);

  const zoomOut = () => {
    setMode("manual");
    setManualScale((s) => Math.max(0.4, +((mode === "fit" ? fitScale : s) - 0.1).toFixed(2)));
  };
  const zoomIn = () => {
    setMode("manual");
    setManualScale((s) => Math.min(2, +((mode === "fit" ? fitScale : s) + 0.1).toFixed(2)));
  };
  const toggleFit = () => {
    if (mode === "fit") { setMode("manual"); setManualScale(1); }
    else { setMode("fit"); }
  };

  return (
    <div className="rs-preview">
      <div className="rs-preview-toolbar">
        <div className="rs-preview-zoom">
          <button className="rs-zoom-btn" onClick={zoomOut} aria-label="Zoom out">−</button>
          <button
            className="rs-zoom-value"
            onClick={toggleFit}
            title="Toggle fit-to-width / 100%"
          >
            {mode === "fit" ? "Fit" : `${displayPercent}%`}
          </button>
          <button className="rs-zoom-btn" onClick={zoomIn} aria-label="Zoom in">+</button>
        </div>
        <div className="rs-device-toggle">
          <button
            className={`rs-device-btn${device === "desktop" ? " is-active" : ""}`}
            onClick={() => setDevice("desktop")}
            aria-label="Desktop preview"
          >🖥</button>
          <button
            className={`rs-device-btn${device === "mobile" ? " is-active" : ""}`}
            onClick={() => setDevice("mobile")}
            aria-label="Mobile preview"
          >📱</button>
        </div>
      </div>

      <div ref={wrapRef} className={`rs-preview-stage rs-device-${device}`}>
        <div
          className="rs-paper"
          style={{
            width: paper.w * scale,
            height: paper.h * scale,
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
      </div>
    </div>
  );
}
