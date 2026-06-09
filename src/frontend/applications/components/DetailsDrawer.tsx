import { useMemo, useState, useEffect } from "react";
import { useApplicationsStore } from "../state/useApplicationsStore";
import { STATUS_LABEL, SOURCE_LABEL, PIPELINE_COLUMNS, type Application, type ApplicationStatus } from "../schema";
import { computeIntelligence } from "../intelligence/ApplicationIntelligenceEngine";
import { CompanyAvatar } from "./CompanyAvatar";

type Tab = "overview" | "timeline" | "notes" | "files";

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return "—";
  }
}

function IntelligenceCard({ app }: { app: Application }) {
  const intel = computeIntelligence(app);
  return (
    <div className="intel-card">
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Application Intelligence</div>
      <div className="intel-row"><span>Age</span><span>{intel.ageDays} days</span></div>
      <div className="intel-row"><span>Status</span><span>{intel.stale ? "⚠ Stale" : "Healthy"}</span></div>
      <div className="intel-row"><span>Response probability</span><span>{Math.round(intel.responseProbability * 100)}%</span></div>
      <div className="intel-progress"><div style={{ width: `${intel.responseProbability * 100}%` }} /></div>
      <div className="intel-row" style={{ marginTop: 8 }}><span>Next action</span><span style={{ fontWeight: 600 }}>{intel.nextRecommendedAction}</span></div>
    </div>
  );
}

function OverviewTab({ app }: { app: Application }) {
  const updateStatus = useApplicationsStore((s) => s.updateStatus);
  return (
    <div>
      <IntelligenceCard app={app} />
      <Field label="Status">
        <select
          value={app.status}
          onChange={(e) => updateStatus(app.id, e.target.value as ApplicationStatus)}
          className="tracker-search"
          style={{ maxWidth: 220 }}
        >
          {PIPELINE_COLUMNS.concat(["withdrawn"]).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
      </Field>
      <Field label="Company">{app.company}</Field>
      <Field label="Role">{app.role}</Field>
      <Field label="Location">{app.location || "—"}</Field>
      <Field label="Source">{SOURCE_LABEL[app.source]}</Field>
      <Field label="Origin">{app.applicationSource === "resume_studio" ? "Resume Studio" : "Local Agent"}</Field>
      <Field label="Applied">{fmtDate(app.appliedAt)}</Field>
      <Field label="ATS Score">{app.atsScore ?? "Not Available"}</Field>
      <Field label="Match Score">{app.matchScore ?? "Not Available"}</Field>
      <Field label="Resume Version">{app.resumeVersion} · {app.templateUsed}</Field>
      <Field label="Salary">{app.jobSnapshot.salary ?? "—"}</Field>
      <Field label="Posting">
        {app.sourceUrl ? (
          <a href={app.sourceUrl} target="_blank" rel="noreferrer">Open original posting ↗</a>
        ) : (
          <button className="files-btn" disabled>No URL</button>
        )}
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="drawer-field">
      <div className="drawer-field-label">{label}</div>
      <div className="drawer-field-value">{children}</div>
    </div>
  );
}

function TimelineTab({ appId }: { appId: string }) {
  const events = useApplicationsStore((s) => s.events);
  const list = useMemo(
    () => events.filter((e) => e.applicationId === appId).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)),
    [events, appId],
  );
  if (list.length === 0) return <div className="empty-state">No events yet.</div>;
  return (
    <div>
      {list.map((e) => (
        <div key={e.id} className="timeline-item">
          <div>{e.title}</div>
          {e.description && <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{e.description}</div>}
          <div className="timeline-time">{fmtDate(e.timestamp)}</div>
        </div>
      ))}
    </div>
  );
}

function NotesTab({ app }: { app: Application }) {
  const [text, setText] = useState(app.notes ?? "");
  const update = useApplicationsStore((s) => s.updateNotes);
  useEffect(() => setText(app.notes ?? ""), [app.id]); // eslint-disable-line
  useEffect(() => {
    const t = setTimeout(() => {
      if (text !== (app.notes ?? "")) update(app.id, text);
    }, 500);
    return () => clearTimeout(t);
  }, [text, app.id, app.notes, update]);
  return (
    <textarea
      className="notes-textarea"
      value={text}
      onChange={(e) => setText(e.target.value)}
      placeholder="Add notes about this application…"
    />
  );
}

function FilesTab({ app }: { app: Application }) {
  return (
    <ul className="files-list">
      <li>
        <span>{app.resumeVersion} · PDF ({app.templateUsed})</span>
        <button className="files-btn" disabled title="Open in Resume Studio to re-export">PDF</button>
      </li>
      <li>
        <span>{app.resumeVersion} · DOCX</span>
        <button className="files-btn" disabled title="Open in Resume Studio to re-export">DOCX</button>
      </li>
      <li>
        <span>Cover Letter</span>
        <button className="files-btn" disabled>Coming soon</button>
      </li>
    </ul>
  );
}

export function DetailsDrawer() {
  const selectedId = useApplicationsStore((s) => s.selectedId);
  const apps = useApplicationsStore((s) => s.applications);
  const select = useApplicationsStore((s) => s.selectApplication);
  const [tab, setTab] = useState<Tab>("overview");
  const app = useMemo(() => apps.find((a) => a.id === selectedId) ?? null, [apps, selectedId]);
  useEffect(() => setTab("overview"), [selectedId]);
  if (!app) return null;
  return (
    <div className="drawer-overlay" onClick={() => select(null)}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <CompanyAvatar company={app.company} size={36} />
            <div>
              <div style={{ fontWeight: 600 }}>{app.company}</div>
              <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))" }}>{app.role}</div>
            </div>
          </div>
          <button className="drawer-close" onClick={() => select(null)} aria-label="Close">×</button>
        </div>
        <div className="drawer-tabs">
          {(["overview", "timeline", "notes", "files"] as Tab[]).map((t) => (
            <button key={t} className={`drawer-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {t[0]!.toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div className="drawer-body">
          {tab === "overview" && <OverviewTab app={app} />}
          {tab === "timeline" && <TimelineTab appId={app.id} />}
          {tab === "notes" && <NotesTab app={app} />}
          {tab === "files" && <FilesTab app={app} />}
        </div>
      </div>
    </div>
  );
}
