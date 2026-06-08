type Variant = "green" | "red" | "yellow";

interface Item { label: string; ok?: boolean; }
interface Props { variant: Variant; title: string; tag: string; items: Item[]; footer?: string; }

const COLOR: Record<Variant, { grad: string; tint: string; accent: string; ring: string }> = {
  green:  { grad: "linear-gradient(135deg, #1f8a64 0%, #0c3d2e 100%)", tint: "rgba(46,204,139,.15)", accent: "#9be3c2", ring: "#2ecc8b" },
  red:    { grad: "linear-gradient(135deg, #b8324a 0%, #4a1421 100%)", tint: "rgba(239,90,111,.15)", accent: "#f4b4be", ring: "#ef5a6f" },
  yellow: { grad: "linear-gradient(135deg, #d99025 0%, #6b3a0b 100%)", tint: "rgba(245,181,68,.15)", accent: "#fde0a8", ring: "#f5b544" },
};

export function StatusCard({ variant, title, tag, items, footer }: Props) {
  const c = COLOR[variant];
  return (
    <div className="profile-status" style={{ background: c.grad }}>
      <div className="profile-status-head">
        <span className="profile-status-mark" aria-hidden style={{ background: c.tint, color: c.accent }}>IMP</span>
        <span className="profile-status-tag" style={{ color: c.accent }}>{tag}</span>
      </div>
      <div className="profile-status-title">{title}</div>
      <ul className="profile-status-list">
        {items.map((i) => (
          <li key={i.label}>
            <span className="bullet" style={{ background: c.ring }} />
            <span>{i.label}</span>
          </li>
        ))}
      </ul>
      {footer && <div className="profile-status-foot">{footer}</div>}
    </div>
  );
}
