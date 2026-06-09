import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useApplicationsStore } from "../state/useApplicationsStore";
import { STATUS_LABEL, SOURCE_LABEL, type Application } from "../schema";
import { CompanyAvatar } from "./CompanyAvatar";
import { computeIntelligence } from "../intelligence/ApplicationIntelligenceEngine";

const PAGE_SIZE = 7;

function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
  } catch {
    return "—";
  }
}

function scoreClass(n?: number): string {
  if (n == null) return "score-pill na";
  if (n >= 80) return "score-pill";
  if (n >= 65) return "score-pill warn";
  return "score-pill bad";
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
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageRows = rows.slice(pageStart, pageStart + PAGE_SIZE);

  const parentRef = useRef<HTMLDivElement>(null);
  const v = useVirtualizer({
    count: pageRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 8,
  });

  return (
    <div className="tracker-section">
      <div className="section-head">
        <h2>All Applications</h2>
      </div>
      <div className="tracker-table-row header">
        <div>Company</div>
        <div>Role</div>
        <div>Location</div>
        <div>Applied</div>
        <div>Resume</div>
        <div>ATS</div>
        <div>Match</div>
        <div>Status</div>
        <div></div>
      </div>
      <div ref={parentRef} className="tracker-table-wrap" style={{ height: Math.min(560, Math.max(180, pageRows.length * 56 + 8)) }}>
        {pageRows.length === 0 ? (
          <div className="empty-state">No applications yet. Use Resume Studio → Apply to create one.</div>
        ) : (
          <div style={{ height: v.getTotalSize(), position: "relative" }}>
            {v.getVirtualItems().map((vi) => {
              const a = pageRows[vi.index]!;
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
                    <span className="cell-truncate" style={{ fontWeight: 600 }}>
                      {a.company}
                      {intel.stale && <span title="Stale" style={{ marginLeft: 4, color: "#b45309" }}>•</span>}
                    </span>
                  </div>
                  <div className="cell-truncate">{a.role}</div>
                  <div className="cell-truncate cell-muted">{a.location || "—"}</div>
                  <div className="cell-muted">{fmtDate(a.appliedAt)}</div>
                  <div className="cell-muted">{a.resumeVersion}</div>
                  <div>{a.atsScore != null ? <span className={scoreClass(a.atsScore)}>{a.atsScore}</span> : <span className="score-pill na">—</span>}</div>
                  <div>{a.matchScore != null ? <span className={scoreClass(a.matchScore)}>{a.matchScore}%</span> : <span className="score-pill na">—</span>}</div>
                  <div><span className={`status-pill status-${a.status}`}>{STATUS_LABEL[a.status]}</span></div>
                  <div>
                    <div className="source-cell" style={{ fontSize: 12 }}>
                      <span className={`source-dot ${a.source}`}></span>
                      <span className="cell-truncate">{SOURCE_LABEL[a.source]}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {rows.length > 0 && (
        <div className="table-foot">
          <div>
            Showing {pageStart + 1} to {Math.min(rows.length, pageStart + PAGE_SIZE)} of {rows.length} applications
          </div>
          <div className="pager">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
            {Array.from({ length: totalPages }).slice(0, 5).map((_, i) => {
              const n = i + 1;
              return (
                <button key={n} className={n === page ? "active" : ""} onClick={() => setPage(n)}>
                  {n}
                </button>
              );
            })}
            {totalPages > 5 && <span style={{ padding: "0 0.3rem" }}>…</span>}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
          </div>
        </div>
      )}
    </div>
  );
}
