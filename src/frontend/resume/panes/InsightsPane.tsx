/** Resume Insights — compact card stack matching the reference design. */
import { useMemo } from "react";
import { useResumeStore } from "@frontend/resume/state/useResumeStore";
import { analyzeAts } from "@frontend/resume/ats/AtsEngine";
import { analyzeJdMatch } from "@frontend/resume/ats/JdMatchEngine";
import { analyzeSkillGap } from "@frontend/resume/ats/SkillGap";

export function InsightsPane() {
  const resume = useResumeStore((s) => s.resume);
  const selectedJob = useResumeStore((s) => s.selectedJob);
  const versions = useResumeStore((s) => s.versions);
  const restoreVersion = useResumeStore((s) => s.restoreVersion);

  const jd = selectedJob?.description ?? "";
  const ats = useMemo(() => analyzeAts(resume, jd), [resume, jd]);
  const jdMatch = useMemo(() => analyzeJdMatch(resume, jd), [resume, jd]);
  const skillGap = useMemo(() => analyzeSkillGap(resume, jd), [resume, jd]);

  const atsScore = ats.atsScore;
  const matched = jdMatch.matchedSkills.length + jdMatch.matchedTech.length;
  const total = matched + jdMatch.missingSkills.length + jdMatch.missingTech.length || 1;
  const matchedRatio = Math.min(1, matched / total);
  const missingKeywords = skillGap.missing.slice(0, 6);

  const verdict = atsScore >= 85 ? "Excellent Match"
    : atsScore >= 70 ? "Strong Match"
    : atsScore >= 55 ? "Needs Polish"
    : "Low Match";

  const reversed = versions.slice().reverse();
  const currentId = reversed[0]?.id;

  return (
    <div className="rs-insights">
      {/* ============ Resume Insights ============ */}
      <div className="rs-card">
        <div className="rs-card-title">Resume Insights</div>

        <div className="rs-ats">
          <div className="rs-ats-text">
            <div className="rs-ats-label">ATS Score <span className="rs-info">ⓘ</span></div>
            <div className="rs-ats-value">{atsScore}%</div>
            <div className="rs-ats-verdict">{verdict}</div>
          </div>
          <ProgressRing percent={atsScore} />
        </div>

        <div className="rs-divider" />

        <div className="rs-block">
          <div className="rs-block-label">Keywords Matched <span className="rs-info">ⓘ</span></div>
          <div className="rs-block-value">
            <span className="rs-num-good">{matched}</span>
            <span className="rs-num-total"> / {total}</span>
          </div>
          <div className="rs-bar">
            <div className="rs-bar-fill" style={{ width: `${matchedRatio * 100}%` }} />
          </div>
        </div>

        <div className="rs-block">
          <div className="rs-block-label">Missing Keywords <span className="rs-info">ⓘ</span></div>
          <div className="rs-pills">
            {missingKeywords.length === 0 ? (
              <span className="rs-pill rs-pill-good">All required keywords covered</span>
            ) : (
              missingKeywords.map((k) => (
                <span key={k} className="rs-pill rs-pill-bad">{k}</span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ============ Resume Versions ============ */}
      <div className="rs-card">
        <div className="rs-card-head">
          <div className="rs-card-title">Resume Versions</div>
          <button className="rs-mini-select">
            {reversed[0]?.label ?? "V1"} (Latest) <span aria-hidden>▾</span>
          </button>
        </div>
        <ul className="rs-version-list">
          {reversed.map((v, i) => (
            <li key={v.id}>
              <button
                className={`rs-version-row${v.id === currentId ? " is-active" : ""}`}
                onClick={() => restoreVersion(v.id)}
              >
                <span className={`rs-version-dot${v.id === currentId ? " is-active" : ""}`} />
                <span className="rs-version-label">
                  {v.label}
                  {i === 0 && <span className="rs-version-tag"> (Latest)</span>}
                </span>
                <span className="rs-version-date">
                  {new Date(v.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* ============ Quick Actions ============ */}
      <div className="rs-card">
        <div className="rs-card-title">Quick Actions</div>
        <button className="rs-quick-row">
          <span aria-hidden>📄</span>
          <span>Tailor for Another Job</span>
          <span className="rs-quick-caret" aria-hidden>›</span>
        </button>
      </div>
    </div>
  );
}

function ProgressRing({ percent }: { percent: number }) {
  const radius = 32;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - Math.max(0, Math.min(100, percent)) / 100);
  return (
    <svg className="rs-ring" width={80} height={80} viewBox="0 0 80 80">
      <circle cx="40" cy="40" r={radius} className="rs-ring-track" />
      <circle
        cx="40" cy="40" r={radius}
        className="rs-ring-fill"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform="rotate(-90 40 40)"
      />
    </svg>
  );
}
