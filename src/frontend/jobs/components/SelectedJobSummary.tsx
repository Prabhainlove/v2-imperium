import type { NormalizedJob } from "@backend/jobs/JobNormalizationService.server";
import { CompanyLogo } from "./JobCard";
import { INTELLIGENCE_LABEL, postedAgo } from "../jobs.logic";

export function SelectedJobSummary({ job }: { job: NormalizedJob | null }) {
  if (!job) {
    return (
      <div className="jobs-summary jobs-summary-empty">
        Select a job from the Top 5 above or the grid below to see match insights.
      </div>
    );
  }
  const intel = INTELLIGENCE_LABEL[job.intelligence];
  return (
    <section className="jobs-summary">
      <div className="jobs-summary-head">
        <CompanyLogo logo={job.companyLogo} name={job.company} />
        <div>
          <h3>{job.title}</h3>
          <div className="jobs-summary-sub">{job.company} · {job.workMode}</div>
          <div className={`jobs-tag ${intel?.tone ?? ""}`}>
            {Math.round(job.matchScore * 100)}% Match · {intel?.text ?? "—"}
          </div>
        </div>
      </div>

      <div className="jobs-summary-meta">
        <Meta icon="💰" label="Salary" value={job.salary} />
        <Meta icon="📍" label="Location" value={job.location || "—"} />
        <Meta icon="🧭" label="Work Mode" value={job.workMode} />
        <Meta icon="🕒" label="Posted" value={postedAgo(job.postedAt)} />
        <Meta icon="🌐" label="Source" value={job.source} />
      </div>

      <div className="jobs-breakdown">
        <h4>MATCH BREAKDOWN</h4>
        <Bar label="Skills Match" value={job.breakdown.skills} />
        <Bar label="Experience Match" value={job.breakdown.experience} />
        <Bar label="Role Match" value={job.breakdown.role} />
        <Bar label="Location Match" value={job.breakdown.location} />
        <Bar label="Salary Match" value={job.breakdown.salary} />
      </div>

      {job.skills.length > 0 && (
        <div className="jobs-skills">
          <h4>KEY SKILLS</h4>
          <div className="jobs-skill-pills">
            {job.skills.slice(0, 12).map((s) => (
              <span key={s} className="jobs-skill-pill">{s}</span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Meta({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="jobs-meta-cell">
      <div className="jobs-meta-icon">{icon}</div>
      <div>
        <div className="jobs-meta-value">{value}</div>
        <div className="jobs-meta-label">{label}</div>
      </div>
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="jobs-bar-row">
      <div className="jobs-bar-label">{label}</div>
      <div className="jobs-bar"><span style={{ width: `${pct}%` }} /></div>
      <div className="jobs-bar-pct">{pct}%</div>
    </div>
  );
}
