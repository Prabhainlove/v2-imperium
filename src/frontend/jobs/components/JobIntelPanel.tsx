import type { NormalizedJob } from "@backend/jobs/JobNormalizationService.server";
import { CompanyLogo } from "./JobCard";
import { INTELLIGENCE_LABEL, postedAgo } from "../jobs.logic";

interface Props {
  job: NormalizedJob | null;
  onApply: (id: string) => void;
  applying: boolean;
}

export function JobIntelPanel({ job, onApply, applying }: Props) {
  if (!job) {
    return (
      <aside className="jobs-intel jobs-intel-empty">
        <div className="jobs-intel-eyebrow">SELECTED JOB</div>
        <p>No job selected yet. Pick one from your matches.</p>
      </aside>
    );
  }
  const intel = INTELLIGENCE_LABEL[job.intelligence];
  return (
    <aside className="jobs-intel">
      <div className="jobs-intel-eyebrow">SELECTED JOB</div>
      <div className="jobs-intel-head">
        <CompanyLogo logo={job.companyLogo} name={job.company} />
        <div>
          <div className="jobs-intel-company">{job.company}</div>
          <div className="jobs-intel-title">{job.title}</div>
          <div className={`jobs-tag ${intel?.tone ?? ""}`}>{Math.round(job.matchScore * 100)}% Match</div>
        </div>
      </div>

      <div className="jobs-intel-meta">
        <div><strong>💰 {job.salary}</strong><span>Estimated CTC</span></div>
        <div><strong>📍 {job.location || "—"}</strong><span>Location</span></div>
        <div><strong>🕒 {postedAgo(job.postedAt)}</strong><span>Posted</span></div>
      </div>

      <button
        type="button"
        className="jobs-btn-primary jobs-intel-cta"
        onClick={() => onApply(job.id)}
        disabled={applying}
      >
        {applying ? "Opening Resume Studio…" : "Generate Resume →"}
      </button>

      <CompanyBanner logo={job.companyLogo} name={job.company} />

      {job.url && (
        <a href={job.url} target="_blank" rel="noreferrer" className="jobs-btn-ghost jobs-intel-link">
          Open Original Job Posting ↗
        </a>
      )}

      <div className="jobs-intel-source">
        <span>Source: {job.source}</span>
        {job.companyWebsite && <a href={job.companyWebsite} target="_blank" rel="noreferrer">{job.companyDomain}</a>}
      </div>

      {job.intelligence === "long_shot" && job.missingSkills.length > 0 && (
        <div className="jobs-intel-note">
          Missing: {job.missingSkills.slice(0, 5).join(", ")}
        </div>
      )}

      <details className="jobs-intel-jd">
        <summary>JOB DESCRIPTION OVERVIEW</summary>
        <p>{job.description.slice(0, 1200) || "Description unavailable."}</p>
      </details>
    </aside>
  );
}

function CompanyBanner({ logo, name }: { logo: string; name: string }) {
  if (!logo) {
    return <div className="jobs-banner jobs-banner-fallback">{name}</div>;
  }
  return (
    <div className="jobs-banner">
      <img
        src={logo}
        alt={name}
        loading="lazy"
        onError={(e) => {
          const parent = e.currentTarget.parentElement;
          if (parent) parent.classList.add("jobs-banner-fallback");
          (e.currentTarget as HTMLElement).style.display = "none";
        }}
      />
    </div>
  );
}
