import type { ReactNode } from "react";

interface Props { title: string; icon?: ReactNode; editable?: boolean; tone?: "violet" | "green" | "amber" | "sky"; children: ReactNode; className?: string; }

const TONE: Record<NonNullable<Props["tone"]>, string> = {
  violet: "#b9a7e0", green: "#7fc7b8", amber: "#f5c452", sky: "#7fb8d8",
};

export function InfoCard({ title, icon, editable = true, tone = "violet", children, className = "" }: Props) {
  return (
    <section className={`profile-info ${className}`}>
      <header className="profile-info-head">
        <span className="profile-info-icon" style={{ color: TONE[tone] }}>{icon}</span>
        <h3 className="profile-info-title">{title}</h3>
        {editable && <button className="profile-info-edit" type="button">Edit</button>}
      </header>
      <div className="profile-info-body">{children}</div>
    </section>
  );
}

export function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="profile-field">
      <div className="profile-field-label">{label}</div>
      <div className="profile-field-value">{value || "—"}</div>
    </div>
  );
}
