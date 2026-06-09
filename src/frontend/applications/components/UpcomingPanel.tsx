import { useMemo } from "react";
import { useApplicationsStore } from "../state/useApplicationsStore";
import { computeIntelligence } from "../intelligence/ApplicationIntelligenceEngine";

export function UpcomingPanel() {
  const apps = useApplicationsStore((s) => s.applications);
  const select = useApplicationsStore((s) => s.selectApplication);
  const { interviews, followUps } = useMemo(() => {
    const interviews = apps.filter((a) => a.status === "interview" || a.status === "assessment");
    const followUps = apps
      .map((a) => ({ a, i: computeIntelligence(a) }))
      .filter(({ a, i }) => (a.status === "applied" || a.status === "viewed") && i.ageDays >= 7)
      .map((x) => x.a);
    return { interviews, followUps };
  }, [apps]);

  return (
    <div className="tracker-section">
      <h2>Upcoming &amp; Follow-ups</h2>
      <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginTop: 8 }}>Interviews</div>
      {interviews.length === 0 ? (
        <div style={{ padding: "0.4rem 0", color: "hsl(var(--muted-foreground))", fontSize: 13 }}>—</div>
      ) : (
        interviews.map((a) => (
          <div key={a.id} className="activity-item" onClick={() => select(a.id)} style={{ cursor: "pointer" }}>
            <div>{a.company}</div>
            <div style={{ fontSize: 12 }}>{a.role}</div>
          </div>
        ))
      )}
      <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginTop: 12 }}>Follow-ups needed</div>
      {followUps.length === 0 ? (
        <div style={{ padding: "0.4rem 0", color: "hsl(var(--muted-foreground))", fontSize: 13 }}>All caught up</div>
      ) : (
        followUps.slice(0, 6).map((a) => {
          const intel = computeIntelligence(a);
          return (
            <div key={a.id} className="activity-item" onClick={() => select(a.id)} style={{ cursor: "pointer" }}>
              <div>{a.company}</div>
              <div style={{ fontSize: 12 }}>{intel.ageDays}d ago</div>
            </div>
          );
        })
      )}
    </div>
  );
}
