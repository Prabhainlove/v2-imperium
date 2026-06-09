import { useState } from "react";
import type { SearchFiltersUI } from "../jobs.logic";
import { EMPTY_FILTERS } from "../jobs.logic";

interface Props {
  initial?: SearchFiltersUI;
  loading: boolean;
  onSearch: (f: SearchFiltersUI) => void;
  onRefresh: () => void;
  canRefresh: boolean;
}

export function JobSearchBar({ initial, loading, onSearch, onRefresh, canRefresh }: Props) {
  const [f, setF] = useState<SearchFiltersUI>(initial ?? EMPTY_FILTERS);
  const set = <K extends keyof SearchFiltersUI>(k: K, v: SearchFiltersUI[K]) => setF((p) => ({ ...p, [k]: v }));

  return (
    <form
      className="jobs-searchbar"
      onSubmit={(e) => { e.preventDefault(); onSearch(f); }}
    >
      <div className="jobs-field">
        <label>Job Title</label>
        <input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Software Engineer" />
      </div>
      <div className="jobs-field">
        <label>Skills</label>
        <input value={f.skills} onChange={(e) => set("skills", e.target.value)} placeholder="e.g. React, Node.js" />
      </div>
      <div className="jobs-field">
        <label>Location</label>
        <input value={f.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Bangalore" />
      </div>
      <div className="jobs-field">
        <label>Experience</label>
        <select value={f.experience} onChange={(e) => set("experience", e.target.value)}>
          <option value="">Any Experience</option>
          <option value="fresher">Fresher</option>
          <option value="0-2">0–2 Years</option>
          <option value="3-5">3–5 Years</option>
          <option value="5+">5+ Years</option>
        </select>
      </div>
      <div className="jobs-field">
        <label>Work Mode</label>
        <select value={f.workMode} onChange={(e) => set("workMode", e.target.value)}>
          <option value="">Any Mode</option>
          <option value="remote">Remote</option>
          <option value="hybrid">Hybrid</option>
          <option value="onsite">On-site</option>
        </select>
      </div>
      <div className="jobs-field">
        <label>Salary Min</label>
        <input value={f.salaryMin} onChange={(e) => set("salaryMin", e.target.value)} placeholder="0" inputMode="numeric" />
      </div>
      <div className="jobs-search-actions">
        <button type="submit" className="jobs-btn-primary" disabled={loading}>
          {loading ? "Searching…" : "Search Jobs"}
        </button>
        <button type="button" className="jobs-btn-ghost" onClick={onRefresh} disabled={!canRefresh || loading}>
          ↻ Refresh Jobs
        </button>
      </div>
    </form>
  );
}
