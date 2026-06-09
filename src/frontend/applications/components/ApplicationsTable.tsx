import { useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useApplicationsStore } from "../state/useApplicationsStore";
import { STATUS_LABEL, SOURCE_LABEL, type Application } from "../schema";
import { CompanyAvatar } from "./CompanyAvatar";
import { computeIntelligence } from "../intelligence/ApplicationIntelligenceEngine";

function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(iso));
  } catch {
    return "—";
  }
}

function filterApps(apps: Application[], search: string, filter: { status?: string; source?: string; resumeVersion?: string }): Application[] {
  const q = search.trim().toLowerCase();
  return apps.filter((a) => {
    if (filter.status && a.status !== filter.status) return false;
    if (filter.source && a.source !== filter.source) return false;
    if (filter.resumeVersion && a.resumeVersion !== filter.resumeVersion) return false;
    if (q && !`${a.company} ${a.role} ${a.location}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function ApplicationsTable() {
  const apps = useApplicationsStore((s) => s.applications);
  const search = useApplicationsStore((s) => s.search);
  const filter = useApplicationsStore((s) => s.filter);
  const select = useApplicationsStore((s) => s.selectApplication);

  const rows = useMemo(() => filterApps(apps, search, filter), [apps, search, filter]);
  const parentRef = useRef<HTMLDivElement>(null);
  const v = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 8,
  });

  return (
    <div className="tracker-section">
      <h2>Applications</h2>
      <div className="tracker-table-row header">
        <div>Company</div>
        <div>Role</div>
        <div>Source</div>
        <div>Status</div>
        <div>ATS</div>
        <div>Match</div>
        <div>Resume</div>
        <div>Applied</div>
      </div>
      <div ref={parentRef} className="tracker-table-wrap" style={{ height: Math.min(480, Math.max(200, rows.length * 48 + 8)) }}>
        {rows.length === 0 ? (
          <div className="empty-state">No applications yet. Use Resume Studio → Apply to create one.</div>
        ) : (
          <div style={{ height: v.getTotalSize(), position: "relative" }}>
            {v.getVirtualItems().map((vi) => {
              const a = rows[vi.index]!;
              const intel = computeIntelligence(a);
              return (
                <div
                  key={a.id}
                  className="tracker-table-row"
                  style={{ position: "absolute", top: 0, left: 0, right: 0, transform: `translateY(${vi.start}px)`, height: vi.size }}
                  onClick={() => select(a.id)}
                >
                  <div className="company-cell">
                    <CompanyAvatar company={a.company} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.company}
                      {intel.stale && <span title="Stale" style={{ marginLeft: 4 }}>⚠️</span>}
                    </span>
                  </div>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.role}</div>
                  <div>{SOURCE_LABEL[a.source]}</div>
                  <div><span className={`status-pill status-${a.status}`}>{STATUS_LABEL[a.status]}</span></div>
                  <div>{a.atsScore ?? "—"}</div>
                  <div>{a.matchScore ?? "—"}</div>
                  <div>{a.resumeVersion}</div>
                  <div>{fmtDate(a.appliedAt)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
