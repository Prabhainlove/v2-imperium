import { useEffect } from "react";
import "./applications.css";
import { useApplicationsStore } from "./state/useApplicationsStore";
import { KpiRow } from "./components/KpiRow";
import { FunnelPanel } from "./components/FunnelPanel";
import { PipelineBoard } from "./components/PipelineBoard";
import { ApplicationsTable } from "./components/ApplicationsTable";
import { FiltersBar } from "./components/FiltersBar";
import { ResumePerformancePanel, SourceAnalyticsPanel } from "./components/AnalyticsRow";
import { ActivityFeed } from "./components/ActivityFeed";
import { UpcomingPanel } from "./components/UpcomingPanel";
import { DetailsDrawer } from "./components/DetailsDrawer";

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
      <div className="tracker-header">
        <div>
          <h1>Application Tracker</h1>
          <div className="muted">Every application originates from Imperium workflows.</div>
        </div>
        <input
          className="tracker-search"
          placeholder="Search company, role, location…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <KpiRow />
      <FunnelPanel />

      <div className="tracker-section">
        <h2>Pipeline</h2>
        <PipelineBoard />
      </div>

      <FiltersBar />
      <ApplicationsTable />

      <div className="analytics-row">
        <ResumePerformancePanel />
        <SourceAnalyticsPanel />
      </div>

      <div className="tracker-bottom">
        <ActivityFeed />
        <UpcomingPanel />
      </div>

      <DetailsDrawer />
    </div>
  );
}

export default ApplicationsPage;
