import avatar from "@/assets/profile/avatar-placeholder.jpg";
import type { ProfilePageData } from "../profile.data";

export function ProfileCard({ data }: { data: ProfilePageData }) {
  const { profile } = data;
  return (
    <div className="profile-card">
      <div className="profile-card-bgnum" aria-hidden>12</div>
      <div className="profile-card-badge" aria-hidden />
      <img src={avatar} alt={profile.name} className="profile-card-img" width={768} height={1024} loading="lazy" />
      <div className="profile-card-meta">
        <div className="role">{profile.headline}</div>
        <div className="name">{profile.name}</div>
        <div className="meta-row">
          <span>2 Years Exp</span><span className="dot" /><span>{profile.location.split(",")[0] || "India"}</span><span className="dot" /><span>Lvl 12</span>
        </div>
      </div>
    </div>
  );
}
