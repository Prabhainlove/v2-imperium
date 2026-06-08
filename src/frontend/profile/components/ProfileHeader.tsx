import { VerticalProgress } from "./VerticalProgress";
import type { ProfilePageData } from "../profile.data";

export function ProfileHeader({ data }: { data: ProfilePageData }) {
  return (
    <div className="profile-header">
      <div className="profile-vbars">
        <VerticalProgress label="Profile Strength" value={data.scores.strength} color="#8b6cf6" />
        <VerticalProgress label="ATS Readiness" value={data.scores.atsReadiness} color="#2ecc8b" />
        <VerticalProgress label="Resume Quality" value={data.scores.resumeQuality} color="#f5b544" />
      </div>
      <div className="profile-title-block">
        <h1 className="profile-h1">
          IMPERIUM<br />
          <span className="thin">Profile</span>
        </h1>
        <p className="profile-sub">Career Identity System</p>
      </div>
    </div>
  );
}
