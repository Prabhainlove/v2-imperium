import type { DashboardData } from "../dashboard.data";
import { COLOR_VARS } from "../dashboard.logic";
import {
  IconStar, IconBriefcase, IconStrength, IconEnergy, IconVelocity, IconFocus,
  IconInfo, ICONS_POWER,
} from "./icons";

export function LeftPanel({ data }: { data: DashboardData }) {
  const { identity, attributes, powers, quote } = data;
  const xpPct = Math.min(100, (identity.xp / identity.xpMax) * 100);

  return (
    <div className="dash-col">
      <div className="dash-card dash-identity">
        <div className="name">{identity.fullName.toUpperCase()}</div>
        <div className="title">{identity.title}</div>
        <div className="dash-stars" aria-label={`${identity.stars} of 7 stars`}>
          {Array.from({ length: identity.stars }).map((_, i) => <IconStar key={i} />)}
        </div>
      </div>

      <div className="dash-card dash-rank">
        <div className="badge"><IconBriefcase width={26} height={26} /></div>
        <div>
          <div className="label">{identity.rankLabel}</div>
          <div className="label">Rank <span className="rank-num">#{identity.rank}</span></div>
          <div className="xpbar"><div style={{ width: `${xpPct}%` }} /></div>
          <div className="xp-text">{identity.xp.toLocaleString()} / {identity.xpMax.toLocaleString()} XP</div>
        </div>
      </div>

      <div className="dash-card">
        <div className="dash-card-title">
          Core Attributes
          <IconInfo width={14} height={14} style={{ color: "#cdb6a4" }} />
        </div>
        <div className="dash-attrs">
          <Attr icon={<IconStrength width={18} height={18}/>} label="Strength" sub="(ATS Score)" value={attributes.atsScore} />
          <Attr icon={<IconEnergy width={18} height={18}/>}  label="Energy"   sub="(Capacity)" value={attributes.capacity} />
          <Attr icon={<IconVelocity width={18} height={18}/>} label="Velocity" sub="(Speed)" value={attributes.speed} />
          <Attr icon={<IconFocus width={18} height={18}/>}   label="Focus"    sub="(Accuracy)" value={attributes.accuracy} />
        </div>
      </div>

      <div className="dash-card">
        <div className="dash-card-title">Imperium Powers</div>
        <div className="dash-powers">
          {powers.map((p) => {
            const Icon = ICONS_POWER[p.iconKey];
            const c = COLOR_VARS[p.color];
            return (
              <div className="dash-power" key={p.id} title={p.description} style={{ ["--dash-glow" as never]: c.glow }}>
                <div className="circle" style={{ background: c.bg, color: c.fg }}>
                  <Icon width={26} height={26} />
                </div>
                <div className="pname">{p.name}</div>
                <div className="plvl">Lv. {p.level}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="dash-card">
        <div className="dash-quote">
          {quote}
          <span className="author">— Imperium</span>
        </div>
      </div>
    </div>
  );
}

function Attr({ icon, label, sub, value }: { icon: React.ReactNode; label: string; sub: string; value: number }) {
  return (
    <div className="dash-attr">
      <span className="ico">{icon}</span>
      <span className="label">{label} <small>{sub}</small></span>
      <span className="val">{value}</span>
      <div className="bar"><div style={{ width: `${Math.min(100, value)}%` }} /></div>
    </div>
  );
}
