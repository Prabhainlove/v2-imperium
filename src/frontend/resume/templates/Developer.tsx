/** Developer — monospaced accents, projects-forward layout. */
import type { TemplateProps } from "./_shared";
import { fmtRange, pageStyle } from "./_shared";
import { themeVars } from "./themes";

export function DeveloperTemplate({ resume, theme }: TemplateProps) {
  const { personal, summary, skills, experience, projects, education, certifications, meta } = resume;
  return (
    <div
      className="resume-page resume-developer"
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
        <div style={{ fontFamily: '"JetBrains Mono", "Menlo", monospace', fontSize: 11, color: "var(--rt-accent)" }}>
          &gt; whoami
        </div>
        <h1 style={{ fontSize: 26, margin: "2px 0 0", fontWeight: 700 }}>{personal.name || "Your Name"}</h1>
        {personal.title && <div style={{ fontSize: 13, color: "var(--rt-text-muted)", marginTop: 2 }}>{personal.title}</div>}
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: "var(--rt-text-muted)", marginTop: 8, display: "flex", flexWrap: "wrap", gap: 14 }}>
          {personal.email && <span>{personal.email}</span>}
          {personal.phone && <span>{personal.phone}</span>}
          {personal.location && <span>{personal.location}</span>}
          {personal.links.map((l) => (
            <a key={l.url} href={l.url} style={{ color: "var(--rt-accent)", textDecoration: "none" }}>[{l.label}]</a>
          ))}
        </div>
      </header>

      {summary && <Section title="// about"><p style={{ margin: 0 }}>{summary}</p></Section>}

      {skills.length > 0 && (
        <Section title="// stack">
          {skills.map((g) => (
            <div key={g.category} className="r-block" style={{ marginBottom: 4, fontFamily: '"JetBrains Mono", monospace', fontSize: 10.8 }}>
              {skills.length > 1 && <span style={{ color: "var(--rt-accent)" }}>{g.category}: </span>}
              {g.items.join(" · ")}
            </div>
          ))}
        </Section>
      )}

      {projects.length > 0 && (
        <Section title="// projects">
          {projects.map((p) => (
            <div key={p.id} className="r-block" style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong style={{ fontFamily: '"JetBrains Mono", monospace' }}>{p.name}</strong>
                {p.url && <a href={p.url} style={{ color: "var(--rt-accent)", fontSize: 10.5, fontFamily: '"JetBrains Mono", monospace' }}>{p.url}</a>}
              </div>
              {p.stack.length > 0 && <div style={{ color: "var(--rt-accent)", fontSize: 10.5, fontFamily: '"JetBrains Mono", monospace' }}>[{p.stack.join(", ")}]</div>}
              <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
                {p.bullets.filter(Boolean).map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            </div>
          ))}
        </Section>
      )}

      {experience.length > 0 && (
        <Section title="// experience">
          {experience.map((e) => (
            <div key={e.id} className="r-block" style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div>
                  <strong>{e.title}</strong>
                  {e.company && <span style={{ color: "var(--rt-accent)" }}> @ {e.company}</span>}
                </div>
                <span style={{ color: "var(--rt-text-muted)", fontSize: 11, fontFamily: '"JetBrains Mono", monospace' }}>{fmtRange(e.start, e.end)}</span>
              </div>
              <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
                {e.bullets.filter(Boolean).map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            </div>
          ))}
        </Section>
      )}

      {education.length > 0 && (
        <Section title="// education">
          {education.map((ed) => (
            <div key={ed.id} className="r-block" style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <div>
                <strong>{ed.school}</strong>
                {(ed.degree || ed.field) && <span style={{ color: "var(--rt-text-muted)" }}> — {[ed.degree, ed.field].filter(Boolean).join(", ")}</span>}
              </div>
              <span style={{ color: "var(--rt-text-muted)", fontFamily: '"JetBrains Mono", monospace' }}>{fmtRange(ed.start, ed.end)}</span>
            </div>
          ))}
        </Section>
      )}

      {certifications.length > 0 && (
        <Section title="// certifications">
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
        fontSize: 12, margin: "0 0 6px", color: "var(--rt-accent)", fontWeight: 700,
        fontFamily: '"JetBrains Mono", "Menlo", monospace',
      }}>{title}</h2>
      <div>{children}</div>
    </section>
  );
}
