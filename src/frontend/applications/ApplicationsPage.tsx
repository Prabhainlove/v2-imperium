import "./applications.css";
import { useApplicationsStore } from "./state/useApplicationsStore";
import { useApplicationsSync } from "./data/useApplicationsData";
import { KpiRow } from "./components/KpiRow";
import { PipelineBoard } from "./components/PipelineBoard";
import { ApplicationsTable } from "./components/ApplicationsTable";
import { FiltersBar } from "./components/FiltersBar";
import { CalendarPanel } from "./components/UpcomingPanel";
import { DetailsDrawer } from "./components/DetailsDrawer";

function SearchIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
}
function BellIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
}
function MoonIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
}

export function ApplicationsPage() {
  const search = useApplicationsStore((s) => s.search);
  const setSearch = useApplicationsStore((s) => s.setSearch);
  const seed = useApplicationsStore((s) => s._seedDemo);
  const total = useApplicationsStore((s) => s.applications.length);

  useEffect(() => {
    if (total === 0) seed();
  }, [total, seed]);

  return (
    <div className="tracker-root">
      <header className="tracker-header">
        <div className="tracker-header-left">
          <h1>Application Tracker</h1>
          <div className="muted">Track, manage and analyze all your job applications in one place.</div>
        </div>
        <div className="tracker-header-right">
          <div className="tracker-search-wrap">
            <span className="tracker-search-icon"><SearchIcon /></span>
            <input
              className="tracker-search"
              placeholder="Search applications..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="tracker-search-kbd">⌘K</span>
          </div>
          <button className="icon-btn" aria-label="Notifications">
            <BellIcon /><span className="badge" />
          </button>
          <button className="icon-btn" aria-label="Theme"><MoonIcon /></button>
          <div className="user-chip">
            <span className="avatar">IM</span>
            <div>
              <div className="name">Imperium User</div>
              <div className="role">Premium</div>
            </div>
          </div>
        </div>
      </header>

      <KpiRow />

      <div className="tracker-section">
        <div className="section-head">
          <h2>Pipeline</h2>
          <div className="section-head-actions">
            <select className="filter-select" defaultValue="">
              <option value="">All Status</option>
            </select>
            <button className="filter-clear">⚙ Customize Pipeline</button>
          </div>
        </div>
        <PipelineBoard />
      </div>

      <FiltersBar />
      <ApplicationsTable />

      <CalendarPanel />

      <DetailsDrawer />
    </div>
  );
}

export default ApplicationsPage;
