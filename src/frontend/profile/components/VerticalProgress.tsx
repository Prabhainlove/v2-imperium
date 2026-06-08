interface Props { label: string; value: number; color: string; }
export function VerticalProgress({ label, value, color }: Props) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="profile-vbar" title={`${label}: ${pct}%`}>
      <div className="profile-vbar-track">
        <div className="profile-vbar-fill" style={{ height: `${pct}%`, background: color }} />
      </div>
      <div className="profile-vbar-meta">
        <span className="val">{pct}%</span>
        <span className="lbl">{label}</span>
      </div>
    </div>
  );
}
