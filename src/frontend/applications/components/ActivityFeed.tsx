import { useMemo } from "react";
import { useApplicationsStore, selectActivityFeed } from "../state/useApplicationsStore";

function relTime(iso: string): string {
  try {
    const diff = Date.now() - Date.parse(iso);
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  } catch {
    return "—";
  }
}

export function ActivityFeed() {
  const events = useApplicationsStore((s) => s.events);
  const apps = useApplicationsStore((s) => s.applications);
  const feed = useMemo(() => selectActivityFeed(events, 20), [events]);
  const appMap = useMemo(() => new Map(apps.map((a) => [a.id, a])), [apps]);
  return (
    <div className="tracker-section">
      <h2>Recent Activity</h2>
      {feed.length === 0 ? (
        <div className="empty-state">No activity yet.</div>
      ) : (
        feed.map((e) => {
          const a = appMap.get(e.applicationId);
          return (
            <div key={e.id} className="activity-item">
              <div>
                <div>{e.title}</div>
                {a && <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{a.company} · {a.role}</div>}
              </div>
              <div className="activity-time">{relTime(e.timestamp)}</div>
            </div>
          );
        })
      )}
    </div>
  );
}
