/** Student / Fresher — education-first ordering, projects highlighted. */
import type { TemplateProps } from "./_shared";
import { fmtRange, pageStyle } from "./_shared";
import { themeVars } from "./themes";

export function StudentTemplate({ resume, theme }: TemplateProps) {
  const { personal, summary, skills, experience, projects, education, certifications, meta } = resume;
  return (
    <div
      className="resume-page resume-student"
      style={{
        ...pageStyle(meta.paper),
        ...themeVars(theme),
        padding: "48px 56px",
        fontFamily: '"Inter", "Helvetica Neue", sans-serif',
        fontSize: 11.5,
        lineHeight: 1.5,
      }}
    >
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 26, margin: 0, fontWeight: 700, color: "var(--rt-accent-dark)" }}>{personal.name || "Your Name"}</h1>
        {personal.title && <div style={{ fontSize: 13, color: "var(--rt-text-muted)", marginTop: 2 }}>{personal.title}</div>}
        <div style={{ fontSize: 11, color: "var(--rt-text-muted)", marginTop: 8, display: "flex", flexWrap: "wrap", gap: 12 }}>
          {personal.email && <span>{personal.email}</span>}
          {personal.phone && <span>{personal.phone}</span>}
          {personal.location && <span>{personal.location}</span>}
          {personal.links.map((l) => (
            <a key={l.url} href={l.url} style={{ color: "var(--rt-accent)", textDecoration: "none" }}>{l.label}</a>
          ))}
        </div>
      </header>

      {summary && <Section title="Objective"><p style={{ margin: 0 }}>{summary}</p></Section>}

      {education.length > 0 && (
        <Section title="Education">
          {education.map((ed) => (
            <div key={ed.id} className="r-block" style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{ed.school}</strong>
                <span style={{ color: "var(--rt-text-muted)" }}>{fmtRange(ed.start, ed.end)}</span>
              </div>
              {(ed.degree || ed.field) && <div>{[ed.degree, ed.field].filter(Boolean).join(", ")}</div>}
              {ed.gpa && <div style={{ color: "var(--rt-text-muted)", fontSize: 11 }}>GPA: {ed.gpa}</div>}
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

      {skills.length > 0 && (
        <Section title="Skills">
          {skills.map((g) => (
            <div key={g.category} className="r-block">
              {skills.length > 1 && <strong style={{ color: "var(--rt-accent-dark)" }}>{g.category}: </strong>}
              {g.items.join(", ")}
            </div>
          ))}
        </Section>
      )}

      {experience.length > 0 && (
        <Section title="Experience">
          {experience.map((e) => (
            <div key={e.id} className="r-block" style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{e.title}{e.company && ` — ${e.company}`}</strong>
                <span style={{ color: "var(--rt-text-muted)" }}>{fmtRange(e.start, e.end)}</span>
              </div>
              <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
                {e.bullets.filter(Boolean).map((b, i) => <li key={i}>{b}</li>)}
              </ul>
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
        letterSpacing: 1.2, color: "var(--rt-accent-dark)", fontWeight: 700,
        borderBottom: `2px solid var(--rt-accent)`, paddingBottom: 3,
      }}>{title}</h2>
      <div>{children}</div>
    </section>
  );
}
