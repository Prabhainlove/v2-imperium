import "./jobs.css";
import { useState } from "react";
import { useDiscovery, useJobDetails, useSelectJob } from "./jobs.logic";
import { ProfileMetricsRail } from "./components/ProfileMetricsRail";
import { JobSearchBar } from "./components/JobSearchBar";
import { TopMatchesRow } from "./components/TopMatchesRow";
import { SelectedJobSummary } from "./components/SelectedJobSummary";
import { JobIntelPanel } from "./components/JobIntelPanel";
import { AllJobsGrid } from "./components/AllJobsGrid";

export function JobsPage() {
  const { search, refresh, data, lastFilters } = useDiscovery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const details = useJobDetails(selectedId);
  const select = useSelectJob();

  const all = data?.all ?? [];
  const top5 = data?.top5 ?? [];
  // Prefer the in-memory list (already has the canonical matchScore + breakdown
  // from the original search context). The fetched details are a fallback.
  const selectedJob = all.find((j) => j.id === selectedId) ?? details.data ?? null;

  const handleView = (id: string) => setSelectedId(id);
  const handleApply = (id: string) => select.mutate(id);

  return (
    <div className="jobs-root">
      <header className="jobs-header">
        <div>
          <h1 className="jobs-title">JOB <span>DISCOVERY ENGINE</span></h1>
          <div className="jobs-subtitle">✨ AI-Powered Job Matching</div>
        </div>
      </header>

      <div className="jobs-layout">
        <ProfileMetricsRail />

        <div className="jobs-main">
          <JobSearchBar
            initial={lastFilters ?? undefined}
            loading={search.isPending}
            onSearch={(f) => { setSelectedId(null); search.mutate(f); }}
            onRefresh={refresh}
            canRefresh={!!lastFilters}
          />

          {search.isError && (
            <div className="jobs-error">Search failed. Try again or adjust filters.</div>
          )}

          <TopMatchesRow jobs={top5} selectedId={selectedId} onSelect={handleView} />
          <SelectedJobSummary job={selectedJob} />
        </div>

        <JobIntelPanel job={selectedJob} onApply={handleApply} applying={select.isPending} />
      </div>

      <AllJobsGrid jobs={all} selectedId={selectedId} onView={handleView} onApply={handleApply} />
    </div>
  );
}

export default JobsPage;
