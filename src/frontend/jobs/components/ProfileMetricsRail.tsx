import { useProfileMetrics } from "../jobs.logic";

interface Metric { label: string; value: number; suffix: string; }

export function ProfileMetricsRail() {
  const { data, isLoading } = useProfileMetrics();
  const metrics: Metric[] = [
    { label: "Profile Strength",  value: data?.profileStrength ?? 0,        suffix: "%" },
    { label: "ATS Readiness",     value: data?.atsReadiness ?? 0,           suffix: "%" },
    { label: "Resume Quality",    value: data?.resumeQuality ?? 0,          suffix: "%" },
    { label: "Applications",      value: data?.applicationsSubmitted ?? 0,  suffix: "" },
    { label: "Interview Rate",    value: data?.interviewSuccessRate ?? 0,   suffix: "%" },
  ];
  return (
    <aside className="jobs-rail" aria-label="Profile metrics">
      {metrics.map((m) => (
        <div key={m.label} className="jobs-metric">
          <div className="jobs-metric-label">{m.label}</div>
          <div className="jobs-metric-value">
            {isLoading ? "…" : m.value}{m.suffix}
          </div>
          {m.suffix === "%" && (
            <div className="jobs-metric-bar"><span style={{ width: `${m.value}%` }} /></div>
          )}
        </div>
      ))}
    </aside>
  );
}
