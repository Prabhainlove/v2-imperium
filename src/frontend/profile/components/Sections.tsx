import { useRef, useState } from "react";
import { InfoCard, Field } from "./InfoCard";
import { toast } from "sonner";
import { extractFromResume, importFromLinkedIn } from "../profile.extraction";
import type { ProfilePageData } from "../profile.data";

export function EducationCard({ data }: { data: ProfilePageData }) {
  const e = data.profile.education[0];
  return (
    <InfoCard title="EDUCATION" icon="🎓" tone="violet">
      <Field label="DEGREE" value={e?.degree ?? ""} />
      <Field label="SPECIALIZATION" value={e?.field ?? ""} />
      <Field label="COLLEGE" value={e?.school ?? ""} />
      <div className="profile-grid-2">
        <Field label="GRADUATION YEAR" value={e?.end ?? ""} />
        <Field label="CGPA" value={e?.gpa ?? ""} />
      </div>
    </InfoCard>
  );
}

export function ExperienceCard({ data }: { data: ProfilePageData }) {
  const exp = data.profile.experience[0];
  return (
    <InfoCard title="EXPERIENCE" icon="💼" tone="green">
      <Field label="CURRENT ROLE" value={exp?.title ?? "AI Engineer Intern"} />
      <Field label="COMPANY" value={exp?.company ?? "TechNova Solutions"} />
      <Field label="YEARS OF EXPERIENCE" value="2 Years" />
      <Field label="PREVIOUS ROLE" value="Full Stack Developer" />
    </InfoCard>
  );
}

export function JobPreferencesCard({ data }: { data: ProfilePageData }) {
  const p = data.profile;
  return (
    <InfoCard title="JOB PREFERENCES" icon="🎯" tone="sky">
      <Field label="PREFERRED ROLE" value={p.target_role} />
      <div className="profile-grid-2">
        <Field label="PREFERRED LOCATION" value={p.target_locations.slice(0, 2).join(", ")} />
        <Field label="WORK MODE" value="Remote / Hybrid" />
      </div>
      <div className="profile-grid-2">
        <Field label="NOTICE PERIOD" value="30 Days" />
        <Field label="EXPECTED CTC" value="12 – 16 LPA" />
      </div>
    </InfoCard>
  );
}

export function SummaryCard({ data }: { data: ProfilePageData }) {
  return (
    <InfoCard title="PROFESSIONAL SUMMARY" icon="👤" tone="violet" className="profile-info--wide">
      <p className="profile-summary-body">{data.profile.summary}</p>
    </InfoCard>
  );
}

export function SkillsCard({ data }: { data: ProfilePageData }) {
  return (
    <InfoCard title="SKILLS" icon="</>" tone="violet">
      <div className="profile-skills">
        {data.profile.skills.slice(0, 8).map((s) => (
          <span key={s} className="profile-skill"><span className="dot" />{s}</span>
        ))}
        <button className="profile-skill add" type="button">+ Add Skill</button>
      </div>
    </InfoCard>
  );
}

export function ProjectsCard({ data }: { data: ProfilePageData }) {
  return (
    <InfoCard title="PROJECTS" icon="🗂️" tone="amber">
      <ul className="profile-projects">
        {data.profile.projects.slice(0, 3).map((p) => (
          <li key={p.name}>
            <span className="ico" aria-hidden>◇</span>
            <div>
              <div className="name">{p.name}</div>
              <div className="desc">{p.description}</div>
            </div>
          </li>
        ))}
      </ul>
      <button className="profile-add-row" type="button">+ Add Project</button>
    </InfoCard>
  );
}

export function ResumeCard({ data }: { data: ProfilePageData }) {
  const ref = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(data.resume.fileName);
  const [size, setSize] = useState(data.resume.sizeLabel);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    try {
      const r = await extractFromResume(f);
      setName(f.name); setSize(`${(f.size / 1024 / 1024).toFixed(1)} MB`);
      toast.success(`Resume parsed locally — ${r.chars.toLocaleString()} characters`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Resume parsing failed");
    }
  }

  return (
    <InfoCard title="RESUME" icon="📄" tone="sky">
      <div className="profile-resume-file">
        <span className="ico">📑</span>
        <div className="meta">
          <div className="name">{name}</div>
          <div className="sub">{size}</div>
        </div>
        <button className="dl" onClick={() => ref.current?.click()} aria-label="Replace resume">⤓</button>
        <input ref={ref} type="file" accept=".pdf,.docx,.txt,.md" hidden onChange={onFile} />
      </div>
      <div className="profile-resume-row">
        <span className="lbl">MASTER RESUME</span>
        <span className="pill active">Active</span>
      </div>
      <div className="profile-resume-row">
        <span className="ok">✓ Resume Extracted Successfully</span>
      </div>
      <div className="profile-resume-row">
        <span className="lbl">LAST UPDATED</span>
        <span className="val">{data.resume.lastUpdated}</span>
      </div>
    </InfoCard>
  );
}

export function CertificationsCard({ data }: { data: ProfilePageData }) {
  return (
    <InfoCard title="CERTIFICATIONS" icon="🏅" tone="amber" className="profile-info--wide">
      <table className="profile-table">
        <tbody>
          {data.profile.certifications.slice(0, 4).map((c) => (
            <tr key={c.name}>
              <td><span className="ico">●</span> {c.name}</td>
              <td>{c.issuer || "—"}</td>
              <td className="muted">Issued: {c.year || "2024"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="profile-add-row" type="button">+ Add Certification</button>
    </InfoCard>
  );
}

export function JobPrefDetailedCard({ data }: { data: ProfilePageData }) {
  const [url, setUrl] = useState(data.profile.linkedin_url);
  async function importLi() {
    const r = await importFromLinkedIn(url);
    (r.ok ? toast.success : toast.message)(r.message);
  }
  return (
    <InfoCard title="JOB PREFERENCES (DETAILED)" icon="🎯" tone="sky" className="profile-info--wide">
      <div className="profile-grid-3">
        <Field label="PREFERRED ROLE" value={data.profile.target_role} />
        <Field label="NOTICE PERIOD" value="30 Days" />
        <Field label="PREFERRED LOCATION" value={data.profile.target_locations.join(", ")} />
        <Field label="EXPECTED CTC" value="12 – 16 LPA" />
        <Field label="WORK MODE" value="Remote / Hybrid" />
        <Field label="INDUSTRIES" value="IT Services, Product Based" />
      </div>
      <div className="profile-linkedin-import">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="LinkedIn profile URL" />
        <button type="button" onClick={importLi}>Import via Ollama</button>
      </div>
    </InfoCard>
  );
}
