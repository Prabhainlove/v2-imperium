/** Resume Insights — deterministic ATS + JD intelligence. Updates with every edit. */
import { useMemo } from "react";
import { useResumeStore } from "@frontend/resume/state/useResumeStore";
import { analyzeAts } from "@frontend/resume/ats/AtsEngine";

export function InsightsPane() {
  const resume = useResumeStore((s) => s.resume);
  const selectedJob = useResumeStore((s) => s.selectedJob);
  const versions = useResumeStore((s) => s.versions);
  const saveVersion = useResumeStore((s) => s.saveVersion);
  const restoreVersion = useResumeStore((s) => s.restoreVersion);

  const report = useMemo(
    () => analyzeAts(resume, selectedJob?.description ?? ""),
    [resume, selectedJob],
  );

  const tone = report.atsScore >= 85 ? "good" : report.atsScore >= 70 ? "ok" : "warn";

  return (
    <div className="resume-insights">
      <div className="resume-insights-card">
        <div className="resume-insights-header">Resume Insights</div>
        <div className={`resume-ats-score resume-ats-${tone}`}>
          <div className="resume-ats-number">{report.atsScore}%</div>
          <div className="resume-ats-label">
            {tone === "good" ? "Excellent Match" : tone === "ok" ? "Good Match" : "Needs Work"}
          </div>
        </div>
        <Metric label="Keyword Match" value={`${report.keywordMatch}%`} />
        <Metric label="Section Completeness" value={`${report.sectionCompleteness}%`} />
        <Metric label="Formatting Safety" value={`${report.formattingSafety}%`} />
        <Metric label="Readability" value={`${report.readability}`} />
        <Metric label="Experience Quality" value={`${report.experienceQuality}%`} />
        <Metric label="Project Quality" value={`${report.projectQuality}%`} />
        <Metric label="Contact Completeness" value={`${report.contactCompleteness}%`} />
        <Metric label="Estimated Pages" value={`${report.pageEstimate}`} />
      </div>

      {selectedJob && (
        <div className="resume-insights-card">
          <div className="resume-insights-header">Missing Keywords</div>
          {report.missingKeywords.length === 0 ? (
            <p className="resume-insights-empty">All target keywords are covered.</p>
          ) : (
            <div className="resume-keywords">
              {report.missingKeywords.slice(0, 12).map((k) => (
                <span key={k} className="resume-keyword resume-keyword-missing">{k}</span>
              ))}
            </div>
          )}
          <div className="resume-insights-subheader">Matched</div>
          <div className="resume-keywords">
            {report.matchedKeywords.slice(0, 12).map((k) => (
              <span key={k} className="resume-keyword resume-keyword-matched">{k}</span>
            ))}
          </div>
        </div>
      )}

      {report.recommendations.length > 0 && (
        <div className="resume-insights-card">
          <div className="resume-insights-header">Recommendations</div>
          <ul className="resume-insights-list">
            {report.recommendations.map((r, i) => <li key={i}>{r}</li>)}
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
                <span className="resume-version-date">{new Date(v.createdAt).toLocaleDateString()}</span>
              </button>
            </li>
          ))}
        </ul>
        <button className="resume-editor-add" onClick={() => saveVersion()}>+ Save current as version</button>
      </div>
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
