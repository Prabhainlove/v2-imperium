import "./resume.css";
import { useResumeStore } from "./state/useResumeStore";
import { EditorPane } from "./panes/EditorPane";
import { PreviewPane } from "./panes/PreviewPane";
import { InsightsPane } from "./panes/InsightsPane";

export function ResumePage() {
  const selectedJob = useResumeStore((s) => s.selectedJob);
  return (
    <div className="resume-root">
      <header className="resume-topbar">
        <div className="resume-topbar-left">
          <span className="resume-topbar-label">Resume Studio</span>
        </div>
        {selectedJob && (
          <div className="resume-topbar-center">
            <strong>{selectedJob.company}</strong>
            <span className="resume-topbar-sep">·</span>
            <span>{selectedJob.title}</span>
          </div>
        )}
        <div className="resume-topbar-right">
          <span className="resume-topbar-hint">Live preview — auto-saved</span>
        </div>
      </header>
      <div className="resume-layout">
        <aside className="resume-col resume-col-editor">
          <EditorPane />
        </aside>
        <main className="resume-col resume-col-preview">
          <PreviewPane />
        </main>
        <aside className="resume-col resume-col-insights">
          <InsightsPane />
        </aside>
      </div>
    </div>
  );
}

export default ResumePage;
