import { useMemo, useState } from "react";
import type { NormalizedJob } from "@backend/jobs/JobNormalizationService.server";
import { JobCard } from "./JobCard";

interface Props {
  jobs: NormalizedJob[];
  selectedId: string | null;
  onView: (id: string) => void;
  onApply: (id: string) => void;
}

type SortKey = "match" | "recent" | "salary";

export function AllJobsGrid({ jobs, selectedId, onView, onApply }: Props) {
  const [sort, setSort] = useState<SortKey>("match");
  const sorted = useMemo(() => {
    const arr = [...jobs];
    if (sort === "match") arr.sort((a, b) => b.matchScore - a.matchScore);
    if (sort === "recent") arr.sort((a, b) => (new Date(b.postedAt ?? 0).getTime()) - (new Date(a.postedAt ?? 0).getTime()));
    if (sort === "salary") arr.sort((a, b) => (b.salaryMin ?? 0) - (a.salaryMin ?? 0));
    return arr;
  }, [jobs, sort]);

  if (jobs.length === 0) return null;

  return (
    <section className="jobs-grid-section">
      <header className="jobs-grid-head">
        <h2>ALL JOBS <span className="jobs-count">({jobs.length} results)</span></h2>
        <label className="jobs-sort">
          Sort by:&nbsp;
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="match">Best Match</option>
            <option value="recent">Most Recent</option>
            <option value="salary">Salary</option>
          </select>
        </label>
      </header>
      <div className="jobs-grid">
        {sorted.map((j) => (
          <JobCard key={j.id} job={j} variant="grid" selected={selectedId === j.id} onView={onView} onApply={onApply} />
        ))}
      </div>
    </section>
  );
}
