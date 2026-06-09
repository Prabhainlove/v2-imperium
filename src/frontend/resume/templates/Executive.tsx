/** Executive — single column, refined serif/sans mix, conservative palette. */
import type { TemplateProps } from "./_shared";
import { fmtRange, pageStyle } from "./_shared";
import { themeVars } from "./themes";

export function ExecutiveTemplate({ resume, theme }: TemplateProps) {
  const { personal, summary, skills, experience, projects, education, certifications, meta } = resume;
  return (
    <div
      className="resume-page resume-executive"
      style={{
        ...pageStyle(meta.paper),
        ...themeVars(theme),
        padding: "60px 72px",
        fontFamily: '"Garamond", "EB Garamond", "Georgia", serif',
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      <header style={{ textAlign: "center", marginBottom: 22, paddingBottom: 16, borderBottom: `1px solid var(--rt-text)` }}>
        <h1 style={{ fontSize: 32, margin: 0, letterSpacing: 4, textTransform: "uppercase", fontWeight: 500 }}>
          {personal.name || "Your Name"}
        </h1>
        {personal.title && <div style={{ fontSize: 13, color: "var(--rt-text-muted)", marginTop: 6, letterSpacing: 2, textTransform: "uppercase" }}>{personal.title}</div>}
        <div style={{ fontSize: 11, color: "var(--rt-text-muted)", marginTop: 10 }}>
          {[personal.email, personal.phone, personal.location].filter(Boolean).join("   •   ")}
        </div>
        {personal.links.length > 0 && (
          <div style={{ fontSize: 11, marginTop: 2 }}>
            {personal.links.map((l, i) => (
              <span key={l.url}>
                {i > 0 && "   •   "}
                <a href={l.url} style={{ color: "var(--rt-accent)", textDecoration: "none" }}>{l.label}</a>
              </span>
            ))}
          </div>
        )}
      </header>

      {summary && <Section title="Executive Summary"><p style={{ margin: 0 }}>{summary}</p></Section>}

      {experience.length > 0 && (
        <Section title="Professional Experience">
          {experience.map((e) => (
            <div key={e.id} className="r-block" style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <strong style={{ fontSize: 13 }}>{e.title}{e.company && <span style={{ fontWeight: 400 }}> — {e.company}</span>}</strong>
                <span style={{ color: "var(--rt-text-muted)", fontSize: 11, fontStyle: "italic" }}>{fmtRange(e.start, e.end)}</span>
              </div>
              {e.location && <div style={{ color: "var(--rt-text-muted)", fontSize: 11, fontStyle: "italic" }}>{e.location}</div>}
              <ul style={{ margin: "4px 0 0 20px", padding: 0 }}>
                {e.bullets.filter(Boolean).map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            </div>
          ))}
        </Section>
      )}

      {skills.length > 0 && (
        <Section title="Core Competencies">
          {skills.map((g) => (
            <div key={g.category} className="r-block">
              {skills.length > 1 && <strong>{g.category}: </strong>}
              {g.items.join("  ·  ")}
            </div>
          ))}
        </Section>
      )}

      {projects.length > 0 && (
        <Section title="Selected Initiatives">
          {projects.map((p) => (
            <div key={p.id} className="r-block" style={{ marginBottom: 10 }}>
              <strong>{p.name}</strong>
              {p.stack.length > 0 && <span style={{ color: "var(--rt-text-muted)", fontStyle: "italic" }}> — {p.stack.join(", ")}</span>}
              <ul style={{ margin: "2px 0 0 20px", padding: 0 }}>
                {p.bullets.filter(Boolean).map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            </div>
          ))}
        </Section>
      )}

      {education.length > 0 && (
        <Section title="Education">
          {education.map((ed) => (
            <div key={ed.id} className="r-block" style={{ display: "flex", justifyContent: "space-between" }}>
              <div><strong>{ed.school}</strong>{(ed.degree || ed.field) && <span> — {[ed.degree, ed.field].filter(Boolean).join(", ")}</span>}</div>
              <span style={{ color: "var(--rt-text-muted)", fontStyle: "italic" }}>{fmtRange(ed.start, ed.end)}</span>
            </div>
          ))}
        </Section>
      )}

      {certifications.length > 0 && (
        <Section title="Certifications & Awards">
          {certifications.map((c) => (
            <div key={c.id} className="r-block">{c.name}{c.issuer && ` — ${c.issuer}`}{c.date && ` (${c.date})`}</div>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 18 }}>
      <h2 style={{
        fontSize: 11.5, margin: "0 0 8px", textTransform: "uppercase",
        letterSpacing: 3, color: "var(--rt-text)", fontWeight: 600, textAlign: "center",
      }}>{title}</h2>
      <div>{children}</div>
    </section>
  );
}
