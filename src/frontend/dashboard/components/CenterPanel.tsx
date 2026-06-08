import type { DashboardData } from "../dashboard.data";
import { HeroPortrait } from "./HeroPortrait";
import {
  IconBriefcase, IconDoc, IconUsers, IconHandshake,
  IconArrowRight, ICONS_ACTIVITY,
} from "./icons";

export function CenterPanel({ data }: { data: DashboardData }) {
  const o = data.careerOverview;
  return (
    <div className="dash-col">
      <HeroPortrait />

      <div className="dash-card">
        <div className="dash-card-title">Career Overview</div>
        <div className="dash-overview">
          <Stat icon={<IconBriefcase width={22} height={22}/>}  bg="#fde2d7" fg="#ee7b5a" label="Jobs Found"   value={o.jobsFound.value}   delta={o.jobsFound.delta} />
          <Stat icon={<IconDoc width={22} height={22}/>}        bg="#d6efe9" fg="#39a896" label="Applications" value={o.applications.value} delta={o.applications.delta} />
          <Stat icon={<IconUsers width={22} height={22}/>}      bg="#e6dff6" fg="#8c79c4" label="Interviews"   value={o.interviews.value}   delta={o.interviews.delta} />
          <Stat icon={<IconHandshake width={22} height={22}/>}  bg="#fceeca" fg="#cc9a1e" label="Offers"       value={o.offers.value}       delta={o.offers.delta} />
        </div>
      </div>

      <div className="dash-card">
        <div className="dash-card-title">Recent Activity</div>
        {data.recentActivity.length === 0 ? (
          <div style={{ color: "var(--dash-muted)", fontSize: 13 }}>No activity yet.</div>
        ) : (
          <div className="dash-activity">
            {data.recentActivity.map((a) => {
              const Icon = ICONS_ACTIVITY[a.iconKey];
              return (
                <div key={a.id} className="dash-activity-row">
                  <span className="ico"><Icon width={16} height={16} /></span>
                  <span>{a.label}</span>
                  <span className="time">{a.timeAgo}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button className="dash-cta">
        Continue Your Journey <IconArrowRight width={18} height={18} />
      </button>
    </div>
  );
}

function Stat({ icon, bg, fg, label, value, delta }: { icon: React.ReactNode; bg: string; fg: string; label: string; value: number; delta: number }) {
  return (
    <div className="dash-stat">
      <div className="ico" style={{ background: bg, color: fg }}>{icon}</div>
      <div className="lbl">{label}</div>
      <div className="val">{value.toLocaleString()}</div>
      <div className="delta">+{delta} this week</div>
    </div>
  );
}
