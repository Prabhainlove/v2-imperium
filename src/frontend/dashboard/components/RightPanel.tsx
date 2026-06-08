import { Link } from "@tanstack/react-router";
import type { DashboardData } from "../dashboard.data";
import { COLOR_VARS, RARITY_RING } from "../dashboard.logic";
import {
  IconUser, IconCal, IconMap, IconId, IconMail,
  IconCore, IconStar, IconStarHalf, IconShield,
  ICONS_INVENTORY,
} from "./icons";

export function RightPanel({ data }: { data: DashboardData }) {
  return (
    <div className="dash-col dash-col-right">
      <ProfileCard data={data} />
      <CoreCard data={data} />
      <InventoryCard data={data} />
      <CrestCard />
    </div>
  );
}

function ProfileCard({ data }: { data: DashboardData }) {
  const i = data.identity;
  return (
    <div className="dash-card dash-profile">
      <div className="avatar"><IconUser width={28} height={28} /></div>
      <div>
        <div className="name">{i.fullName.toUpperCase()}</div>
        <div className="sub">Master of Opportunities</div>
        <div className="meta">
          <div className="meta-row"><IconCal width={14} height={14}/> <strong>Level {i.level}</strong></div>
          <div className="meta-row"><IconId  width={14} height={14}/> <strong>{i.imperiumId}</strong></div>
          <div className="meta-row"><IconMap width={14} height={14}/> <strong>{i.country}</strong></div>
          <div className="meta-row"><IconMail width={14} height={14}/> <strong style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{i.email}</strong></div>
        </div>
        <div className="tabs">
          <button>Profile</button>
          <button data-active="true">Arsenal</button>
          <button>Settings</button>
          <button className="view3d">3D View ▾</button>
        </div>
      </div>
      <div className="avatar-2"><IconUser width={28} height={28} /></div>
    </div>
  );
}

function CoreCard({ data }: { data: DashboardData }) {
  const c = data.equippedCore;
  const full = Math.floor(c.powerLevel);
  const half = c.powerLevel - full >= 0.5;
  return (
    <div className="dash-card">
      <div className="dash-card-title">Equipped Core Module</div>
      <div className="dash-core">
        <div className="ico" style={{ background: "#d6efe9", color: "#39a896" }}>
          <IconCore width={36} height={36} />
        </div>
        <div>
          <div className="name">{c.name}</div>
          <div className="desc">{c.description}</div>
          <div className="power">
            <span>Power Level</span>
            <span className="stars">
              {Array.from({ length: full }).map((_, i) => <IconStar key={i} />)}
              {half && <IconStarHalf />}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function InventoryCard({ data }: { data: DashboardData }) {
  return (
    <div className="dash-card">
      <div className="dash-card-title dash-inv-header">
        <span>Agent Modules (Inventory)</span>
        <button className="dash-inv-view-all">View All</button>
      </div>
      <div className="dash-inv">
        {data.inventory.map((m) => {
          const Icon = ICONS_INVENTORY[m.iconKey];
          const c = COLOR_VARS[m.color];
          return (
            <Link
              key={m.id}
              to={m.route}
              className="dash-tile"
              style={{
                ["--tile-bg" as never]: c.bg,
                ["--tile-fg" as never]: c.fg,
                ["--tile-glow" as never]: c.glow,
              }}
            >
              <span className="rarity" style={{ background: RARITY_RING[m.rarity] }} title={m.rarity} />
              <div className="ico"><Icon width={22} height={22} /></div>
              <div className="nm">{m.name}</div>
              <div className="lvl">Lv. {m.level}</div>
              <div className="dash-tooltip">{m.description}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function CrestCard() {
  return (
    <div className="dash-card dash-crest">
      <div className="badge"><IconShield width={36} height={36} /></div>
      <div>
        <div className="title">Imperium Crest</div>
        <div className="desc">Symbol of mastery and career excellence.</div>
      </div>
    </div>
  );
}
