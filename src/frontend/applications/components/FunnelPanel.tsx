import { useMemo } from "react";
import { useApplicationsStore, selectFunnel } from "../state/useApplicationsStore";

export function FunnelPanel() {
  const apps = useApplicationsStore((s) => s.applications);
  const f = useMemo(() => selectFunnel(apps), [apps]);
  const max = Math.max(f.applied, 1);
  const stages: [string, number][] = [
    ["Applied", f.applied],
    ["Viewed", f.viewed],
    ["Review", f.review],
    ["Interview", f.interview],
    ["Offer", f.offer],
  ];
  return (
    <div className="funnel-panel">
      <div className="funnel-title">Application Funnel</div>
      <div className="funnel-row">
        {stages.map(([label, value]) => (
          <div key={label} className="funnel-stage">
            <div className="funnel-stage-label">{label}</div>
            <div className="funnel-stage-value">{value}</div>
            <div className="funnel-bar" style={{ width: `${(value / max) * 100}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
