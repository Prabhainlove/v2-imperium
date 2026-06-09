/** Minimal — light typography, generous whitespace, ATS-safe. */
import type { TemplateProps } from "./_shared";
import { fmtRange, pageStyle } from "./_shared";
import { themeVars } from "./themes";

export function MinimalTemplate({ resume, theme }: TemplateProps) {
  const { personal, summary, skills, experience, projects, education, certifications, meta } = resume;
  return (
    <div
      className="resume-page resume-minimal"
      style={{
        ...pageStyle(meta.paper),
        ...themeVars(theme),
        padding: "64px 72px",
        fontFamily: '"Georgia", "Times New Roman", serif',
        fontSize: 11.5,
        lineHeight: 1.6,
      }}
    >
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 30, margin: 0, fontWeight: 400, letterSpacing: -0.3 }}>{personal.name || "Your Name"}</h1>
        {personal.title && <div style={{ fontSize: 12.5, color: "var(--rt-text-muted)", marginTop: 4, fontStyle: "italic" }}>{personal.title}</div>}
        <div style={{ fontSize: 11, color: "var(--rt-text-muted)", marginTop: 10 }}>
          {[personal.email, personal.phone, personal.location].filter(Boolean).join("   ·   ")}
        </div>
        {personal.links.length > 0 && (
          <div style={{ fontSize: 11, marginTop: 2 }}>
            {personal.links.map((l, i) => (
              <span key={l.url}>
                {i > 0 && "   ·   "}
                <a href={l.url} style={{ color: "var(--rt-accent)", textDecoration: "none" }}>{l.label}</a>
              </span>
            ))}
          </div>
        )}
      </header>

      {summary && <Section title="Summary"><p style={{ margin: 0 }}>{summary}</p></Section>}

      {experience.length > 0 && (
        <Section title="Experience">
          {experience.map((e) => (
            <div key={e.id} className="r-block" style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div><strong>{e.title}</strong>{e.company && <span style={{ color: "var(--rt-text-muted)" }}>, {e.company}</span>}</div>
                <span style={{ color: "var(--rt-text-muted)", fontSize: 11, fontStyle: "italic" }}>{fmtRange(e.start, e.end)}</span>
              </div>
              <ul style={{ margin: "4px 0 0 20px", padding: 0 }}>
                {e.bullets.filter(Boolean).map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            </div>
          ))}
        </Section>
      )}

      {projects.length > 0 && (
        <Section title="Projects">
          {projects.map((p) => (
            <div key={p.id} className="r-block" style={{ marginBottom: 12 }}>
              <strong>{p.name}</strong>
              {p.stack.length > 0 && <span style={{ color: "var(--rt-text-muted)", fontStyle: "italic" }}> — {p.stack.join(", ")}</span>}
              <ul style={{ margin: "2px 0 0 20px", padding: 0 }}>
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
              {skills.length > 1 && <strong>{g.category} — </strong>}
              <span>{g.items.join(", ")}</span>
            </div>
          ))}
        </Section>
      )}

      {education.length > 0 && (
        <Section title="Education">
          {education.map((ed) => (
            <div key={ed.id} className="r-block" style={{ display: "flex", justifyContent: "space-between" }}>
              <div><strong>{ed.school}</strong>{(ed.degree || ed.field) && <span style={{ color: "var(--rt-text-muted)" }}> — {[ed.degree, ed.field].filter(Boolean).join(", ")}</span>}</div>
              <span style={{ color: "var(--rt-text-muted)", fontStyle: "italic" }}>{fmtRange(ed.start, ed.end)}</span>
            </div>
          ))}
        </Section>
      )}

      {certifications.length > 0 && (
        <Section title="Certifications">
          {certifications.map((c) => (
            <div key={c.id} className="r-block">
              {c.name}{c.issuer && <span style={{ color: "var(--rt-text-muted)" }}>, {c.issuer}</span>}{c.date && <span style={{ color: "var(--rt-text-muted)" }}> ({c.date})</span>}
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 16 }}>
      <h2 style={{
        fontSize: 11, margin: "0 0 6px", textTransform: "uppercase",
        letterSpacing: 2, color: "var(--rt-text-muted)", fontWeight: 400,
      }}>{title}</h2>
      <div>{children}</div>
    </section>
  );
}
