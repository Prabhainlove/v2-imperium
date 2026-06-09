import "./activity.css";
import { useApplicationsStore } from "@frontend/applications/state/useApplicationsStore";
import { useApplicationsSync } from "@frontend/applications/data/useApplicationsData";

export function ActivityPage() {
  useApplicationsSync();
  const applications = useApplicationsStore((s) => s.applications);
  const events = [...applications]
    .sort(
      (a, b) =>
        new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime(),
    )
    .slice(0, 30);
  return (
    <div className="activity-root min-h-screen p-8 max-w-3xl mx-auto">
      <h1 className="activity-title text-3xl font-semibold mb-6">Activity</h1>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No activity yet. Apply to a role from the Jobs page to start your timeline.
        </p>
      ) : (
        <ul className="space-y-3">
          {events.map((a) => (
            <li
              key={a.id}
              className="rounded-xl border border-border bg-card p-4 flex items-center justify-between"
            >
              <div>
                <div className="text-sm font-medium">
                  {a.role} <span className="text-muted-foreground">— {a.company}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Status: {a.status} · {new Date(a.appliedAt).toLocaleDateString()}
                </div>
              </div>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                {a.source}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ActivityPage;
