import type { NormalizedJob } from "@backend/jobs/JobNormalizationService.server";
import { INTELLIGENCE_LABEL, companyInitials, postedAgo } from "../jobs.logic";

interface Props {
  job: NormalizedJob;
  selected?: boolean;
  variant?: "top" | "grid";
  onView: (id: string) => void;
  onApply?: (id: string) => void;
}

export function JobCard({ job, selected, variant = "grid", onView, onApply }: Props) {
  const intel = INTELLIGENCE_LABEL[job.intelligence];
  return (
    <div
      role="button"
      tabIndex={0}
      className={`jobs-card jobs-card-${variant}${selected ? " is-selected" : ""}`}
      onClick={() => onView(job.id)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onView(job.id); } }}
    >
      <div className="jobs-card-head">
        <CompanyLogo logo={job.companyLogo} name={job.company} />
        <div className="jobs-card-title">
          <div className="jobs-card-company">{job.company}</div>
          <div className="jobs-card-role">{job.title}</div>
        </div>
      </div>
      <div className="jobs-card-match">{Math.round(job.matchScore * 100)}% Match</div>
      <div className="jobs-card-meta">
        <span>💰 {job.salary}</span>
        <span>📍 {job.location || "—"}</span>
        <span>🕒 {postedAgo(job.postedAt)}</span>
      </div>
      <div className={`jobs-tag ${intel?.tone ?? ""}`}>{intel?.text ?? "—"}</div>
      {variant === "grid" && (
        <div className="jobs-card-actions" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="jobs-btn-ghost-sm" onClick={() => onView(job.id)}>View Details</button>
          {onApply && (
            <button type="button" className="jobs-btn-primary-sm" onClick={() => onApply(job.id)}>Apply</button>
          )}
        </div>
      )}
    </div>
  );
}

export function CompanyLogo({ logo, name }: { logo: string; name: string }) {
  if (logo) return <img className="jobs-logo" src={logo} alt={name} loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />;
  return <div className="jobs-logo jobs-logo-fallback">{companyInitials(name)}</div>;
}
