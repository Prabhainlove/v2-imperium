/** Professional — single column, accent-colored section headings. */
import type { TemplateProps } from "./_shared";
import { fmtRange, pageStyle } from "./_shared";
import { themeVars } from "./themes";

export function ProfessionalTemplate({ resume, theme }: TemplateProps) {
  const { personal, summary, skills, experience, projects, education, certifications, meta } = resume;
  return (
    <div
      className="resume-page resume-professional"
      style={{
        ...pageStyle(meta.paper),
        ...themeVars(theme),
        padding: "56px 64px",
        fontFamily: '"Calibri", "Helvetica Neue", sans-serif',
        fontSize: 11.5,
        lineHeight: 1.5,
      }}
    >
      <header style={{ borderBottom: `3px solid var(--rt-accent)`, paddingBottom: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 28, margin: 0, color: "var(--rt-accent-dark)", fontWeight: 700 }}>
          {personal.name || "Your Name"}
        </h1>
        {personal.title && <div style={{ fontSize: 14, color: "var(--rt-accent)", marginTop: 4, letterSpacing: 0.3 }}>{personal.title}</div>}
        <div style={{ fontSize: 11, color: "var(--rt-text-muted)", marginTop: 8, display: "flex", flexWrap: "wrap", gap: 12 }}>
          {personal.email && <span>✉ {personal.email}</span>}
          {personal.phone && <span>☎ {personal.phone}</span>}
          {personal.location && <span>📍 {personal.location}</span>}
          {personal.links.map((l) => (
            <a key={l.url} href={l.url} style={{ color: "var(--rt-accent)", textDecoration: "none" }}>{l.label}</a>
          ))}
        </div>
      </header>

      {summary && <Section title="Profile"><p style={{ margin: 0 }}>{summary}</p></Section>}

      {experience.length > 0 && (
        <Section title="Experience">
          {experience.map((e) => (
            <div key={e.id} className="r-block" style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div>
                  <strong style={{ fontSize: 12.5 }}>{e.title}</strong>
                  {e.company && <span style={{ color: "var(--rt-accent)" }}> · {e.company}</span>}
                </div>
                <span style={{ color: "var(--rt-text-muted)", fontSize: 11 }}>{fmtRange(e.start, e.end)}</span>
              </div>
              {e.location && <div style={{ fontStyle: "italic", color: "var(--rt-text-muted)", fontSize: 10.5 }}>{e.location}</div>}
              <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
                {e.bullets.filter(Boolean).map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            </div>
          ))}
        </Section>
      )}

      {skills.length > 0 && (
        <Section title="Skills">
          {skills.map((g) => (
            <div key={g.category} className="r-block" style={{ marginBottom: 4 }}>
              {skills.length > 1 && <strong style={{ color: "var(--rt-accent-dark)" }}>{g.category}: </strong>}
              {g.items.join(" · ")}
            </div>
          ))}
        </Section>
      )}

      {projects.length > 0 && (
        <Section title="Projects">
          {projects.map((p) => (
            <div key={p.id} className="r-block" style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{p.name}</strong>
                {p.url && <a href={p.url} style={{ color: "var(--rt-accent)", fontSize: 10.5 }}>{p.url}</a>}
              </div>
              {p.stack.length > 0 && <div style={{ color: "var(--rt-text-muted)", fontSize: 10.5 }}>{p.stack.join(" · ")}</div>}
              <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
                {p.bullets.filter(Boolean).map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            </div>
          ))}
        </Section>
      )}

      {education.length > 0 && (
        <Section title="Education">
          {education.map((ed) => (
            <div key={ed.id} className="r-block" style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <div>
                <strong>{ed.school}</strong>
                {(ed.degree || ed.field) && <div style={{ color: "var(--rt-text-muted)" }}>{[ed.degree, ed.field].filter(Boolean).join(", ")}</div>}
                {ed.gpa && <div style={{ color: "var(--rt-text-muted)", fontSize: 10.5 }}>GPA: {ed.gpa}</div>}
              </div>
              <span style={{ color: "var(--rt-text-muted)" }}>{fmtRange(ed.start, ed.end)}</span>
            </div>
          ))}
        </Section>
      )}

      {certifications.length > 0 && (
        <Section title="Certifications">
          <ul style={{ margin: "0 0 0 18px", padding: 0 }}>
            {certifications.map((c) => (
              <li key={c.id} className="r-block">{c.name}{c.issuer && ` — ${c.issuer}`}{c.date && ` (${c.date})`}</li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 14 }}>
      <h2 style={{
        fontSize: 12, margin: "0 0 6px", textTransform: "uppercase",
        letterSpacing: 1.5, color: "var(--rt-accent-dark)", fontWeight: 700,
      }}>{title}</h2>
      <div>{children}</div>
    </section>
  );
}
