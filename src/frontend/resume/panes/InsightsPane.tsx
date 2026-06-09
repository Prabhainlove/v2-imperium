/** Resume Insights — ATS + Health + JD Match + Skill Gap + Templates + AI + Exports. */
import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useResumeStore } from "@frontend/resume/state/useResumeStore";
import { analyzeAts } from "@frontend/resume/ats/AtsEngine";
import { analyzeHealth } from "@frontend/resume/ats/HealthEngine";
import { analyzeJdMatch } from "@frontend/resume/ats/JdMatchEngine";
import { analyzeSkillGap } from "@frontend/resume/ats/SkillGap";
import { getTemplate } from "@frontend/resume/templates/registry";
import { recommendTemplate } from "@frontend/resume/templates/recommend";
import { PrintRenderer, type PrintHandle } from "@frontend/resume/export/PrintRenderer";
import { exportResumeToPdf, validatePrintLayout } from "@frontend/resume/export/pdf";
import { exportResumeToDocx } from "@frontend/resume/export/docx";
import { useAiQueue, useAiRunner } from "@frontend/resume/ai/useAi";
import {
  aiGenerateSummary,
  aiFillMissing,
  aiAnalyzeJd,
} from "@frontend/resume/ai/resume-ai.functions";
import "@frontend/resume/export/print.css";

export function InsightsPane() {
  const resume = useResumeStore((s) => s.resume);
  const selectedJob = useResumeStore((s) => s.selectedJob);
  const versions = useResumeStore((s) => s.versions);
  const saveVersion = useResumeStore((s) => s.saveVersion);
  const restoreVersion = useResumeStore((s) => s.restoreVersion);
  const setTemplate = useResumeStore((s) => s.setTemplate);
  const patch = useResumeStore((s) => s.patch);

  const aiTasks = useAiQueue();
  const { run: runAi } = useAiRunner();
  const summaryFn = useServerFn(aiGenerateSummary);
  const fillFn = useServerFn(aiFillMissing);
  const analyzeJdFn = useServerFn(aiAnalyzeJd);
  const [aiError, setAiError] = useState<string | null>(null);

  const jd = selectedJob?.description ?? "";
  const ats = useMemo(() => analyzeAts(resume, jd), [resume, jd]);
  const health = useMemo(() => analyzeHealth(resume), [resume]);
  const jdMatch = useMemo(() => analyzeJdMatch(resume, jd), [resume, jd]);
  const skillGap = useMemo(() => analyzeSkillGap(resume, jd), [resume, jd]);
  const recommendation = useMemo(() => recommendTemplate(resume, jd), [resume, jd]);
  const activeTemplate = getTemplate(resume.meta.templateId);

  const printHandleRef = useRef<PrintHandle | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    const h = printHandleRef.current;
    if (!h) return;
    setExporting(true);
    try {
      const v = validatePrintLayout(h.node, resume);
      setWarnings(v.warnings);
      await exportResumeToPdf(h.node, resume);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="resume-insights">
      <div className="resume-insights-card">
        <div className="resume-insights-header">Score Overview</div>
        <div className="resume-score-grid">
          <ScoreBadge label="ATS Score" value={ats.atsScore} />
          <ScoreBadge label="Resume Health" value={health.score} />
          <ScoreBadge label="JD Match" value={jdMatch.score} disabled={!jd} />
        </div>
        <div className="resume-export-row">
          <button
            className="resume-export-btn"
            onClick={handleExport}
            disabled={exporting}
          >{exporting ? "Exporting…" : "Export PDF"}</button>
          <button
            className="resume-editor-add"
            onClick={() =>
              saveVersion(undefined, {
                atsScore: ats.atsScore,
                resumeHealth: health.score,
                jdMatch: jdMatch.score,
              })
            }
          >Save version</button>
        </div>
        {warnings.length > 0 && (
          <ul className="resume-insights-list resume-warnings">
            {warnings.map((w, i) => <li key={i}>⚠ {w}</li>)}
          </ul>
        )}
      </div>

      <div className="resume-insights-card">
        <div className="resume-insights-header">ATS Detail</div>
        <Metric label="Keyword Match" value={`${ats.keywordMatch}%`} />
        <Metric label="Section Completeness" value={`${ats.sectionCompleteness}%`} />
        <Metric label="Formatting Safety" value={`${ats.formattingSafety}%`} />
        <Metric label="Readability" value={`${ats.readability}`} />
        <Metric label="Experience Quality" value={`${ats.experienceQuality}%`} />
        <Metric label="Project Quality" value={`${ats.projectQuality}%`} />
        <Metric label="Contact Completeness" value={`${ats.contactCompleteness}%`} />
        <Metric label="Estimated Pages" value={`${ats.pageEstimate}`} />
      </div>

      <div className="resume-insights-card">
        <div className="resume-insights-header">Resume Health Detail</div>
        <Metric label="Content Strength" value={`${health.contentStrength}%`} />
        <Metric label="Experience Strength" value={`${health.experienceStrength}%`} />
        <Metric label="Project Strength" value={`${health.projectStrength}%`} />
        <Metric label="Achievement Strength" value={`${health.achievementStrength}%`} />
        <Metric label="Completeness" value={`${health.completeness}%`} />
      </div>

      {jd && (
        <div className="resume-insights-card">
          <div className="resume-insights-header">Skill Gap Analysis</div>
          <div className="resume-skillgap-summary">
            <div><strong>{skillGap.matched.length}</strong> matched</div>
            <div><strong>{skillGap.missing.length}</strong> missing</div>
            <div><strong>{skillGap.coverage}%</strong> coverage</div>
          </div>
          {skillGap.missing.length > 0 && (
            <>
              <div className="resume-insights-subheader">Missing</div>
              <div className="resume-keywords">
                {skillGap.missing.slice(0, 14).map((k) => (
                  <span key={k} className="resume-keyword resume-keyword-missing">{k}</span>
                ))}
              </div>
            </>
          )}
          {skillGap.matched.length > 0 && (
            <>
              <div className="resume-insights-subheader">Matched</div>
              <div className="resume-keywords">
                {skillGap.matched.slice(0, 14).map((k) => (
                  <span key={k} className="resume-keyword resume-keyword-matched">{k}</span>
                ))}
              </div>
            </>
          )}
          {skillGap.recommended.length > 0 && (
            <>
              <div className="resume-insights-subheader">Recommended to add</div>
              <div className="resume-keywords">
                {skillGap.recommended.map((k) => (
                  <span key={k} className="resume-keyword resume-keyword-rec">{k}</span>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="resume-insights-card">
        <div className="resume-insights-header">Template Analysis</div>
        <div className="resume-template-active">{activeTemplate.name} · <span style={{ color: "hsl(var(--muted-foreground))" }}>{activeTemplate.category}</span></div>
        <Metric label="ATS Compatibility" value={`${activeTemplate.atsCompatibility}`} />
        <Metric label="Visual Appeal" value={`${activeTemplate.visualAppeal}`} />
        <Metric label="Recruiter Readability" value={`${activeTemplate.recruiterReadability}`} />
        <div className="resume-insights-subheader">Best for</div>
        <div className="resume-template-bestfor">{activeTemplate.bestFor.join(" · ")}</div>
      </div>

      {recommendation.template.id !== resume.meta.templateId && (
        <div className="resume-insights-card resume-recommendation">
          <div className="resume-insights-header">Recommended Template</div>
          <div className="resume-template-active">{recommendation.template.name}</div>
          <p className="resume-insights-empty" style={{ marginTop: 4 }}>{recommendation.reason}</p>
          <button className="resume-editor-add" onClick={() => setTemplate(recommendation.template.id)}>
            Switch to {recommendation.template.name}
          </button>
        </div>
      )}

      {ats.recommendations.length > 0 && (
        <div className="resume-insights-card">
          <div className="resume-insights-header">Recommendations</div>
          <ul className="resume-insights-list">
            {ats.recommendations.map((r, i) => <li key={i}>{r}</li>)}
            {health.notes.map((r, i) => <li key={`h${i}`}>{r}</li>)}
          </ul>
        </div>
      )}

      <div className="resume-insights-card">
        <div className="resume-insights-header">Versions</div>
        <ul className="resume-versions">
          {versions.slice().reverse().map((v) => (
            <li key={v.id}>
              <button className="resume-version-btn" onClick={() => restoreVersion(v.id)}>
                <span>{v.label}</span>
                <span className="resume-version-date">
                  {v.atsScore != null && `ATS ${v.atsScore} · `}
                  {new Date(v.createdAt).toLocaleDateString()}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Hidden full-size renderer for PDF export */}
      <PrintRenderer resume={resume} registerHandle={(h) => { printHandleRef.current = h; }} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="resume-metric">
      <span className="resume-metric-label">{label}</span>
      <span className="resume-metric-value">{value}</span>
    </div>
  );
}

function ScoreBadge({ label, value, disabled }: { label: string; value: number; disabled?: boolean }) {
  const tone = disabled ? "muted" : value >= 85 ? "good" : value >= 70 ? "ok" : "warn";
  return (
    <div className={`resume-score-badge resume-score-${tone}`}>
      <div className="resume-score-value">{disabled ? "—" : value}</div>
      <div className="resume-score-label">{label}</div>
    </div>
  );
}
