import { useMemo } from "react";
import { useApplicationsStore, selectKpis } from "../state/useApplicationsStore";

function fmtPct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

type IconName = "send" | "clock" | "calendar" | "briefcase" | "trending" | "users";
const Icon = ({ name }: { name: IconName }) => {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "send":      return <svg {...common}><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>;
    case "clock":     return <svg {...common}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
    case "calendar":  return <svg {...common}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
    case "briefcase": return <svg {...common}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>;
    case "trending":  return <svg {...common}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>;
    case "users":     return <svg {...common}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
  }
};

interface CardDef {
  label: string;
  value: string | number;
  icon: IconName;
  tone: "indigo" | "amber" | "violet" | "emerald" | "cyan" | "rose";
  delta?: string;
  sub?: string;
}

export function KpiRow() {
  const apps = useApplicationsStore((s) => s.applications);
  const k = useMemo(() => selectKpis(apps), [apps]);
  const cards: CardDef[] = [
    { label: "Applications Sent", value: k.sent, icon: "send", tone: "indigo", sub: `${k.active} active` },
    { label: "Under Review", value: k.underReview, icon: "clock", tone: "amber", sub: "Awaiting recruiter" },
    { label: "Interviews", value: k.interviews, icon: "calendar", tone: "violet", sub: k.interviews ? "Upcoming rounds" : "—" },
    { label: "Offers", value: k.offers, icon: "briefcase", tone: "emerald", sub: k.offers ? "Active negotiations" : "—" },
    { label: "Response Rate", value: fmtPct(k.responseRate), icon: "trending", tone: "cyan", sub: `${Math.round(k.responseRate * k.sent)} responses` },
    { label: "Interview Rate", value: fmtPct(k.interviewRate), icon: "users", tone: "rose", sub: k.stale ? `${k.stale} stale` : "All fresh" },
  ];
  return (
    <div className="kpi-row">
      {cards.map((c) => (
        <div key={c.label} className="kpi-card">
          <div className="kpi-card-top">
            <span className={`kpi-icon ${c.tone}`}><Icon name={c.icon} /></span>
            {c.delta && <span className="kpi-delta">{c.delta}</span>}
          </div>
          <div className="kpi-label">{c.label}</div>
          <div className="kpi-value">{c.value}</div>
          {c.sub && <div className="kpi-sub">{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}
