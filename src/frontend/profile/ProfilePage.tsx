import "./profile.css";
import { ClientOnly, useNavigate } from "@tanstack/react-router";
import { useProfilePageData } from "./profile.data";
import { ProfileHeader } from "./components/ProfileHeader";
import { ProfileCard } from "./components/ProfileCard";
import { StatusCard } from "./components/StatusCard";
import { RightRail } from "./components/RightRail";
import { McLarenScene } from "./components/McLarenScene";
import {
  EducationCard, ExperienceCard, JobPreferencesCard, SummaryCard,
  SkillsCard, ProjectsCard, ResumeCard, CertificationsCard, JobPrefDetailedCard,
} from "./components/Sections";

export function ProfilePage() {
  const data = useProfilePageData();
  const navigate = useNavigate();
  return (
    <div className="profile-root">
      <div className="profile-bg-3d" aria-hidden>
        <ClientOnly fallback={null}>
          <McLarenScene />
        </ClientOnly>
      </div>

      <div className="profile-topbar">
        <div className="profile-logo" aria-hidden>◐</div>
        <div className="profile-top-actions">
          <div className="profile-chip"><span className="dot red" />297 <span className="caret">▾</span></div>
          <div className="profile-chip"><span className="dot gold" />1,258 <span className="caret">▾</span></div>
          <button className="profile-gear" onClick={() => navigate({ to: "/settings" })} aria-label="Settings">⚙</button>
        </div>
      </div>

      <div className="profile-hero">
        <ProfileHeader />
        <ProfileCard data={data} />
        <RightRail data={data} />
      </div>

      <div className="profile-status-row">
        <StatusCard variant="green" tag="EXTRACT" title="Profile Extraction"
          items={data.extraction.map((e) => ({ label: (e.ok ? "✓ " : "• ") + e.label }))}
          footer="Local extraction complete" />
        <StatusCard variant="red" tag="GAPS" title="Missing Information"
          items={data.missing.length ? data.missing : [{ label: "All required fields present" }]}
          footer={`${data.missing.length} items need attention`} />
        <StatusCard variant="yellow" tag="OPTIMIZE" title="Optimization Suggestions"
          items={data.optimization}
          footer={`ATS Score: ${data.scores.atsReadiness}/100`} />
      </div>

      <div className="profile-row-3">
        <EducationCard data={data} />
        <ExperienceCard data={data} />
        <JobPreferencesCard data={data} />
      </div>

      <SummaryCard data={data} />

      <div className="profile-row-3">
        <SkillsCard data={data} />
        <ProjectsCard data={data} />
        <ResumeCard data={data} />
      </div>

      <div className="profile-row-2">
        <CertificationsCard data={data} />
        <JobPrefDetailedCard data={data} />
      </div>
    </div>
  );
}

export default ProfilePage;
