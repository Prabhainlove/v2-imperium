import { useMemo } from "react";
import { useApplicationsStore, selectKpis } from "../state/useApplicationsStore";

function fmtPct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export function KpiRow() {
  const apps = useApplicationsStore((s) => s.applications);
  const k = useMemo(() => selectKpis(apps), [apps]);
  const cards = [
    { label: "Applications Sent", value: k.sent },
    { label: "Active", value: k.active },
    { label: "Under Review", value: k.underReview },
    { label: "Interviews", value: k.interviews },
    { label: "Offers", value: k.offers },
    { label: "Response Rate", value: fmtPct(k.responseRate) },
    { label: "Interview Rate", value: fmtPct(k.interviewRate) },
    { label: "Stale", value: k.stale, sub: k.stale ? "Needs follow-up" : "All fresh" },
  ];
  return (
    <div className="kpi-row">
      {cards.map((c) => (
        <div key={c.label} className="kpi-card">
          <div className="kpi-label">{c.label}</div>
          <div className="kpi-value">{c.value}</div>
          {c.sub && <div className="kpi-sub">{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}
