import type { NormalizedJob } from "@backend/jobs/JobNormalizationService.server";
import { JobCard } from "./JobCard";

interface Props {
  jobs: NormalizedJob[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function TopMatchesRow({ jobs, selectedId, onSelect }: Props) {
  if (jobs.length === 0) {
    return (
      <div className="jobs-top-row jobs-top-empty">
        Run a search to see your top 5 matches.
      </div>
    );
  }
  return (
    <section>
      <header className="jobs-section-head">
        <span className="jobs-section-icon">👑</span>
        <h2>TOP 5 BEST MATCHED JOBS</h2>
      </header>
      <div className="jobs-top-row">
        {jobs.slice(0, 5).map((j) => (
          <JobCard key={j.id} job={j} variant="top" selected={selectedId === j.id} onView={onSelect} />
        ))}
      </div>
    </section>
  );
}
