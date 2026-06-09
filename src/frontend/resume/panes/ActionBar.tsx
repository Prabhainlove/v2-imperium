/** Sticky bottom action bar — saved indicator, version history, exports, AI, Apply. */
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useResumeStore } from "@frontend/resume/state/useResumeStore";
import { analyzeAts } from "@frontend/resume/ats/AtsEngine";
import { analyzeJdMatch } from "@frontend/resume/ats/JdMatchEngine";
import { analyzeHealth } from "@frontend/resume/ats/HealthEngine";
import { getTemplate } from "@frontend/resume/templates/registry";
import { exportResumeToPdf } from "@frontend/resume/export/pdf";
import { exportResumeToDocx } from "@frontend/resume/export/docx";
import { useApplicationsStore } from "@frontend/applications/state/useApplicationsStore";
import { aiGenerateSummary } from "@frontend/resume/ai/resume-ai.functions";
import { useAiRunner } from "@frontend/resume/ai/useAi";
import type { PrintHandle } from "@frontend/resume/export/PrintRenderer";

export function ActionBar({
  printHandleRef,
}: {
  printHandleRef: React.MutableRefObject<PrintHandle | null>;
}) {
  const resume = useResumeStore((s) => s.resume);
  const selectedJob = useResumeStore((s) => s.selectedJob);
  const versions = useResumeStore((s) => s.versions);
  const saveVersion = useResumeStore((s) => s.saveVersion);
  const patch = useResumeStore((s) => s.patch);
  const create = useApplicationsStore((s) => s.createFromResumeStudio);
  const navigate = useNavigate();

  const { run: runAi } = useAiRunner();
  const summaryFn = useServerFn(aiGenerateSummary);

  const jd = selectedJob?.description ?? "";
  const ats = useMemo(() => analyzeAts(resume, jd), [resume, jd]);
  const health = useMemo(() => analyzeHealth(resume), [resume]);
  const jdMatch = useMemo(() => analyzeJdMatch(resume, jd), [resume, jd]);
  const activeTemplate = getTemplate(resume.meta.templateId);

  const [exporting, setExporting] = useState<null | "pdf" | "docx">(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [applied, setApplied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const handleSave = () => {
    saveVersion(undefined, {
      atsScore: ats.atsScore,
      resumeHealth: health.score,
      jdMatch: jdMatch.score,
    });
  };

  const handlePdf = async () => {
    const h = printHandleRef.current;
    if (!h) return;
    setExporting("pdf");
    try { await exportResumeToPdf(h.node, resume); }
    finally { setExporting(null); }
  };

  const handleDocx = async () => {
    setExporting("docx");
    try { await exportResumeToDocx(resume); }
    finally { setExporting(null); }
  };

  const handleGenerate = async () => {
    setAiBusy(true);
    try {
      const ctx = {
        name: resume.personal.name,
        title: resume.personal.title,
        summary: resume.summary,
        skills: resume.skills.flatMap((g) => g.items),
        experienceSnippets: resume.experience.flatMap((e) => e.bullets).slice(0, 6),
        projectSnippets: resume.projects.flatMap((p) => p.bullets).slice(0, 4),
      };
      const res = await runAi({
        feature: "summary",
        label: "Generate with AI",
        cacheInput: ctx,
        cacheJd: jd,
        call: () => summaryFn({ data: { resume: ctx, jd } }),
      });
      if (res.summary) patch((r) => { r.summary = res.summary; });
    } catch { /* swallow */ }
    finally { setAiBusy(false); }
  };

  const handleApply = () => {
    if (!selectedJob) return;
    const versionLabel = versions[versions.length - 1]?.label ?? "V1";
    create({
      job: {
        title: selectedJob.title,
        company: selectedJob.company,
        description: selectedJob.description,
      },
      resume: {
        resumeId: "current",
        resumeVersion: versionLabel,
        templateUsed: activeTemplate?.name ?? resume.meta.templateId,
      },
      atsScore: ats.atsScore,
      matchScore: jdMatch.score,
    });
    setApplied(true);
    setTimeout(() => navigate({ to: "/applications" }), 600);
  };

  return (
    <>
      <div className="rs-actionbar">
        <div className="rs-actionbar-left">
          <span className="rs-saved-indicator">
            <span className="rs-saved-check" aria-hidden>✓</span> All changes saved
          </span>
        </div>

        <div className="rs-actionbar-center">
          <button className="rs-btn rs-btn-ghost" onClick={() => setShowHistory(true)}>
            <span aria-hidden>🕘</span> Version History
          </button>
          <button className="rs-btn rs-btn-ghost" onClick={handleSave}>
            <span aria-hidden>💾</span> Save
          </button>
          <button className="rs-btn rs-btn-ghost" onClick={handlePdf} disabled={exporting !== null}>
            <span aria-hidden>📄</span> {exporting === "pdf" ? "Exporting…" : "Export PDF"}
          </button>
          <button className="rs-btn rs-btn-ghost" onClick={handleDocx} disabled={exporting !== null}>
            <span aria-hidden>📑</span> {exporting === "docx" ? "Exporting…" : "Export DOCX"}
          </button>
        </div>

        <div className="rs-actionbar-right">
          <button
            className="rs-btn rs-btn-primary"
            onClick={handleGenerate}
            disabled={aiBusy}
          >
            <span aria-hidden>✨</span> {aiBusy ? "Generating…" : "Generate with AI"}
          </button>
          <button
            className="rs-btn rs-btn-primary"
            onClick={handleApply}
            disabled={!selectedJob || applied}
            title={!selectedJob ? "Select a job first" : "Submit to tracker"}
          >
            <span aria-hidden>✈</span> {applied ? "Added" : "Apply"}
          </button>
        </div>
      </div>

      {showHistory && (
        <div className="rs-modal-backdrop" onClick={() => setShowHistory(false)}>
          <div className="rs-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rs-modal-head">
              <div className="rs-modal-title">Version History</div>
              <button className="rs-icon-btn" onClick={() => setShowHistory(false)}>×</button>
            </div>
            <div className="rs-modal-body">
              <ul className="rs-history-list">
                {versions.slice().reverse().map((v) => (
                  <li key={v.id}>
                    <div className="rs-history-label">{v.label}</div>
                    <div className="rs-history-meta">
                      {v.atsScore != null && `ATS ${v.atsScore} · `}
                      {new Date(v.createdAt).toLocaleString()}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
