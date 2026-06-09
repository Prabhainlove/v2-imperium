import { useMemo } from "react";
import { useApplicationsStore, selectResumePerformance, selectSourcePerformance } from "../state/useApplicationsStore";
import { SOURCE_LABEL } from "../schema";

export function ResumePerformancePanel() {
  const apps = useApplicationsStore((s) => s.applications);
  const rows = useMemo(() => selectResumePerformance(apps), [apps]);
  return (
    <div className="tracker-section">
      <h2>Resume Performance</h2>
      {rows.length === 0 ? (
        <div className="empty-state">No data yet.</div>
      ) : (
        rows.map((r) => (
          <div key={r.resumeVersion} className="analytics-line">
            <div><strong>{r.resumeVersion}</strong> · {r.applications} apps · ATS {r.avgATS} · Match {r.avgMatchScore}</div>
            <div>{r.interviews} interviews · {r.offers} offers · {Math.round(r.interviewRate * 100)}%</div>
          </div>
        ))
      )}
    </div>
  );
}

export function SourceAnalyticsPanel() {
  const apps = useApplicationsStore((s) => s.applications);
  const rows = useMemo(() => selectSourcePerformance(apps), [apps]);
  return (
    <div className="tracker-section">
      <h2>Source Performance</h2>
      {rows.length === 0 ? (
        <div className="empty-state">No data yet.</div>
      ) : (
        rows.map((r) => (
          <div key={r.source} className="analytics-line">
            <div><strong>{SOURCE_LABEL[r.source]}</strong> · {r.applications} apps</div>
            <div>{r.responses} resp · {r.interviews} int · {r.offers} off · {Math.round(r.responseRate * 100)}%</div>
          </div>
        ))
      )}
    </div>
  );
}
