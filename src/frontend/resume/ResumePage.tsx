import "./resume.css";
import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useResumeStore } from "./state/useResumeStore";
import { EditorPane } from "./panes/EditorPane";
import { PreviewPane } from "./panes/PreviewPane";
import { InsightsPane } from "./panes/InsightsPane";
import { ActionBar } from "./panes/ActionBar";
import { PrintRenderer, type PrintHandle } from "./export/PrintRenderer";
import "./export/print.css";

export function ResumePage() {
  const selectedJob = useResumeStore((s) => s.selectedJob);
  const versions = useResumeStore((s) => s.versions);
  const resume = useResumeStore((s) => s.resume);
  const navigate = useNavigate();

  const printHandleRef = useRef<PrintHandle | null>(null);
  const [jdOpen, setJdOpen] = useState(false);

  const latest = versions[versions.length - 1];
  const company = selectedJob?.company ?? "Imperium Labs";
  const role = selectedJob?.title ?? "Senior Frontend Engineer";
  const initials = company.slice(0, 1).toUpperCase();

  return (
    <div className="rs-root">
      {/* ============ TOP BAR ============ */}
      <header className="rs-topbar">
        <div className="rs-topbar-left">
          <button
            type="button"
            className="rs-back"
            onClick={() => navigate({ to: "/applications" })}
          >
            <span aria-hidden>←</span> Back to Resumes
          </button>
        </div>

        <div className="rs-topbar-center">
          <div className="rs-job-chip">
            <div className="rs-job-logo" aria-hidden>{initials}</div>
            <div className="rs-job-meta">
              <div className="rs-job-company">
                {company} <span className="rs-job-link" aria-hidden>↗</span>
              </div>
              <div className="rs-job-role">{role}</div>
            </div>
            <span className="rs-job-caret" aria-hidden>▾</span>
          </div>

          <div className="rs-stat">
            <div className="rs-stat-label">Match Score</div>
            <div className="rs-stat-value rs-stat-good">● 94%</div>
          </div>

          <div className="rs-stat">
            <div className="rs-stat-label">Resume Version</div>
            <div className="rs-stat-value">
              {latest?.label ?? "V1"} <span className="rs-job-caret" aria-hidden>▾</span>
            </div>
          </div>
        </div>

        <div className="rs-topbar-right">
          <button className="rs-icon-btn" aria-label="Previous">‹</button>
          <button className="rs-icon-btn" aria-label="Next">›</button>
          <button
            type="button"
            className="rs-jd-btn"
            onClick={() => setJdOpen(true)}
          >
            <span aria-hidden>📄</span> View Job Description
          </button>
        </div>
      </header>

      {/* ============ THREE COLUMNS ============ */}
      <div className="rs-layout">
        <aside className="rs-col rs-col-editor">
          <EditorPane />
        </aside>
        <main className="rs-col rs-col-preview">
          <PreviewPane />
        </main>
        <aside className="rs-col rs-col-insights">
          <InsightsPane />
        </aside>
      </div>

      {/* ============ BOTTOM ACTION BAR ============ */}
      <ActionBar printHandleRef={printHandleRef} />

      {/* hidden full-size renderer for PDF export */}
      <PrintRenderer resume={resume} registerHandle={(h) => { printHandleRef.current = h; }} />

      {/* ============ JD MODAL ============ */}
      {jdOpen && (
        <div className="rs-modal-backdrop" onClick={() => setJdOpen(false)}>
          <div className="rs-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rs-modal-head">
              <div>
                <div className="rs-modal-title">{role}</div>
                <div className="rs-modal-sub">{company}</div>
              </div>
              <button className="rs-icon-btn" onClick={() => setJdOpen(false)} aria-label="Close">×</button>
            </div>
            <div className="rs-modal-body">
              {selectedJob?.description ?? "No job description attached."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ResumePage;
