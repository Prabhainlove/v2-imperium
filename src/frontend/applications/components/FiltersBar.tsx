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
    <div className="filters-bar">
      <select
        value={filter.status ?? ""}
        onChange={(e) => setFilter({ status: (e.target.value || undefined) as ApplicationStatus | undefined })}
        className="filter-select"
      >
        <option value="">All Status</option>
        {PIPELINE_COLUMNS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
      </select>
      <select
        value={filter.source ?? ""}
        onChange={(e) => setFilter({ source: (e.target.value || undefined) as ApplicationSourcePortal | undefined })}
        className="filter-select"
      >
        <option value="">All Sources</option>
        {SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
      </select>
      <select
        value={filter.resumeVersion ?? ""}
        onChange={(e) => setFilter({ resumeVersion: e.target.value || undefined })}
        className="filter-select"
      >
        <option value="">All Resumes</option>
        {versions.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
      <select className="filter-select" defaultValue="90">
        <option value="7">Last 7 Days</option>
        <option value="30">Last 30 Days</option>
        <option value="90">Last 90 Days</option>
        <option value="365">Last Year</option>
      </select>
      {(filter.status || filter.source || filter.resumeVersion) && (
        <button className="filter-clear" onClick={clearFilter}>Clear</button>
      )}
    </div>
  );
}
