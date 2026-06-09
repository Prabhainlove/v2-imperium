import { useMemo, useState, useEffect } from "react";
import { useApplicationsStore } from "../state/useApplicationsStore";
import { STATUS_LABEL, SOURCE_LABEL, PIPELINE_COLUMNS, type Application, type ApplicationStatus } from "../schema";
import { computeIntelligence } from "../intelligence/ApplicationIntelligenceEngine";
import { CompanyAvatar } from "./CompanyAvatar";

type Tab = "overview" | "timeline" | "notes" | "files";

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return "—";
  }
}
function fmtDateTime(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return "—";
  }
}

/* Icon set for field labels */
const I = {
  cal: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  link: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  pin: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  globe: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  file: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  layout: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>,
  check: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  target: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  cash: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  note: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
};

function IntelligenceCard({ app }: { app: Application }) {
  const intel = computeIntelligence(app);
  return (
    <div className="intel-card">
      <div style={{ fontWeight: 600, marginBottom: 6, fontSize: "0.85rem" }}>Application Intelligence</div>
      <div className="intel-row"><span>Age</span><span>{intel.ageDays} days</span></div>
      <div className="intel-row"><span>Status</span><span>{intel.stale ? "⚠ Stale" : "Healthy"}</span></div>
      <div className="intel-row"><span>Response probability</span><span>{Math.round(intel.responseProbability * 100)}%</span></div>
      <div className="intel-progress"><div style={{ width: `${intel.responseProbability * 100}%` }} /></div>
      <div className="intel-row" style={{ marginTop: 8 }}><span>Next action</span><span style={{ fontWeight: 600 }}>{intel.nextRecommendedAction}</span></div>
    </div>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="drawer-field">
      <span className="drawer-field-label">{icon} {label}</span>
      <span className="drawer-field-value">{children}</span>
    </div>
  );
}

function OverviewTab({ app }: { app: Application }) {
  const updateStatus = useApplicationsStore((s) => s.updateStatus);
  const [editing, setEditing] = useState(false);
  return (
    <div>
      <IntelligenceCard app={app} />
      <Field icon={<I.cal />} label="Applied On">{fmtDate(app.appliedAt)}</Field>
      <Field icon={<I.link />} label="Job URL">
        {app.sourceUrl
          ? <a href={app.sourceUrl} target="_blank" rel="noreferrer">View Job ↗</a>
          : <span className="cell-muted">—</span>}
      </Field>
      <Field icon={<I.pin />} label="Location">{app.location || "—"}</Field>
      <Field icon={<I.globe />} label="Source">{SOURCE_LABEL[app.source]}</Field>
      <Field icon={<I.file />} label="Resume Version">{app.resumeVersion}</Field>
      <Field icon={<I.layout />} label="Template Used">{app.templateUsed}</Field>
      <Field icon={<I.check />} label="ATS Score">
        {app.atsScore != null ? <span className="score-pill">{app.atsScore}/100</span> : <span className="score-pill na">N/A</span>}
      </Field>
      <Field icon={<I.target />} label="Match Score">
        {app.matchScore != null ? <span className="score-pill">{app.matchScore}%</span> : <span className="score-pill na">N/A</span>}
      </Field>
      <Field icon={<I.cash />} label="Expected Salary">{app.jobSnapshot.salary ?? "—"}</Field>
      <Field icon={<I.note />} label="Notes">
        <span className="cell-muted" style={{ fontSize: "0.78rem" }}>{app.notes ? app.notes.slice(0, 40) + (app.notes.length > 40 ? "…" : "") : "—"}</span>
      </Field>

      {editing ? (
        <div style={{ marginTop: "1rem", padding: "0.7rem", border: "1px solid #e2e8f0", borderRadius: "0.55rem" }}>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.4rem" }}>Update Status</div>
          <select
            value={app.status}
            onChange={(e) => updateStatus(app.id, e.target.value as ApplicationStatus)}
            className="filter-select"
            style={{ width: "100%" }}
          >
            {PIPELINE_COLUMNS.concat(["withdrawn"]).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
          <button className="drawer-edit-btn" style={{ marginTop: "0.6rem" }} onClick={() => setEditing(false)}>Done</button>
        </div>
      ) : (
        <button className="drawer-edit-btn" onClick={() => setEditing(true)}>Edit Details</button>
      )}

      <NextStepCard app={app} />
    </div>
  );
}

function NextStepCard({ app }: { app: Application }) {
  if (app.status !== "interview" && app.status !== "assessment" && app.status !== "offer") return null;
  const intel = computeIntelligence(app);
  return (
    <div className="next-step-card">
      <div className="next-step-title">Next Step</div>
      <div className="next-step-row">
        <span className="next-step-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
        </span>
        <div className="next-step-text">
          <div className="next-step-name">{app.status === "offer" ? "Offer Negotiation" : "Interview Scheduled"}</div>
          <div className="next-step-date">{intel.nextRecommendedAction}</div>
        </div>
      </div>
      <button className="next-step-all" onClick={(e) => e.preventDefault()}>View All Interviews</button>
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
          {e.description && <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{e.description}</div>}
          <div className="timeline-time">{fmtDateTime(e.timestamp)}</div>
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
          <div className="drawer-header-info">
            <CompanyAvatar company={app.company} size={44} />
            <div>
              <h3>{app.company}</h3>
              <div style={{ fontSize: "0.85rem", color: "#475569" }}>{app.role}</div>
              <div className="subrow">
                <span className="status-dot" />
                <span>{STATUS_LABEL[app.status]}</span>
              </div>
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
