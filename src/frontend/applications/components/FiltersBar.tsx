import { useApplicationsStore } from "../state/useApplicationsStore";
import { PIPELINE_COLUMNS, SOURCE_LABEL, STATUS_LABEL, type ApplicationSourcePortal, type ApplicationStatus } from "../schema";

const SOURCES: ApplicationSourcePortal[] = ["linkedin", "naukri", "foundit", "instahyre", "hirist", "wellfound", "other"];

export function FiltersBar() {
  const filter = useApplicationsStore((s) => s.filter);
  const setFilter = useApplicationsStore((s) => s.setFilter);
  const clearFilter = useApplicationsStore((s) => s.clearFilter);
  const apps = useApplicationsStore((s) => s.applications);
  const versions = Array.from(new Set(apps.map((a) => a.resumeVersion))).sort();
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <select
        value={filter.status ?? ""}
        onChange={(e) => setFilter({ status: (e.target.value || undefined) as ApplicationStatus | undefined })}
        className="tracker-search"
        style={{ maxWidth: 160 }}
      >
        <option value="">All statuses</option>
        {PIPELINE_COLUMNS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
      </select>
      <select
        value={filter.source ?? ""}
        onChange={(e) => setFilter({ source: (e.target.value || undefined) as ApplicationSourcePortal | undefined })}
        className="tracker-search"
        style={{ maxWidth: 160 }}
      >
        <option value="">All sources</option>
        {SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
      </select>
      <select
        value={filter.resumeVersion ?? ""}
        onChange={(e) => setFilter({ resumeVersion: e.target.value || undefined })}
        className="tracker-search"
        style={{ maxWidth: 160 }}
      >
        <option value="">All resume versions</option>
        {versions.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
      {(filter.status || filter.source || filter.resumeVersion) && (
        <button className="tracker-actions" onClick={clearFilter} style={{ background: "transparent", color: "inherit", border: "1px solid hsl(var(--border))", padding: "0.4rem 0.7rem", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
          Clear
        </button>
      )}
    </div>
  );
}
