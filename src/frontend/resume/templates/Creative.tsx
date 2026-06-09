/** Creative — colored header band, two-column grid for skills/contact. */
import type { TemplateProps } from "./_shared";
import { fmtRange, pageStyle } from "./_shared";
import { themeVars } from "./themes";

export function CreativeTemplate({ resume, theme }: TemplateProps) {
  const { personal, summary, skills, experience, projects, education, certifications, meta } = resume;
  return (
    <div
      className="resume-page resume-creative"
      style={{
        ...pageStyle(meta.paper),
        ...themeVars(theme),
        padding: 0,
        fontFamily: '"Inter", "Helvetica Neue", sans-serif',
        fontSize: 11.5,
        lineHeight: 1.5,
      }}
    >
      <header style={{ background: "var(--rt-accent)", color: "#fff", padding: "36px 48px" }}>
        <h1 style={{ fontSize: 30, margin: 0, fontWeight: 800, letterSpacing: -0.5 }}>{personal.name || "Your Name"}</h1>
        {personal.title && <div style={{ fontSize: 14, opacity: 0.92, marginTop: 4 }}>{personal.title}</div>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 11, marginTop: 12, opacity: 0.95 }}>
          {personal.email && <span>{personal.email}</span>}
          {personal.phone && <span>{personal.phone}</span>}
          {personal.location && <span>{personal.location}</span>}
          {personal.links.map((l) => (
            <a key={l.url} href={l.url} style={{ color: "#fff", textDecoration: "underline" }}>{l.label}</a>
          ))}
        </div>
      </header>

      <div style={{ padding: "32px 48px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div>
          {summary && <Section title="About"><p style={{ margin: 0 }}>{summary}</p></Section>}
          {experience.length > 0 && (
            <Section title="Experience">
              {experience.map((e) => (
                <div key={e.id} className="r-block" style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong>{e.title}</strong>
                    <span style={{ color: "var(--rt-text-muted)", fontSize: 10.5 }}>{fmtRange(e.start, e.end)}</span>
                  </div>
                  {e.company && <div style={{ color: "var(--rt-accent)", fontSize: 11.5 }}>{e.company}</div>}
                  <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
                    {e.bullets.filter(Boolean).map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                </div>
              ))}
            </Section>
          )}
        </div>
        <div>
          {skills.length > 0 && (
            <Section title="Skills">
              {skills.map((g) => (
                <div key={g.category} className="r-block" style={{ marginBottom: 6 }}>
                  {skills.length > 1 && <div style={{ fontWeight: 600, color: "var(--rt-accent-dark)", fontSize: 11 }}>{g.category}</div>}
                  <div>{g.items.join(" · ")}</div>
                </div>
              ))}
            </Section>
          )}
          {projects.length > 0 && (
            <Section title="Projects">
              {projects.map((p) => (
                <div key={p.id} className="r-block" style={{ marginBottom: 10 }}>
                  <strong>{p.name}</strong>
                  {p.stack.length > 0 && <div style={{ color: "var(--rt-text-muted)", fontSize: 10.5 }}>{p.stack.join(" · ")}</div>}
                  <ul style={{ margin: "2px 0 0 18px", padding: 0 }}>
                    {p.bullets.filter(Boolean).map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                </div>
              ))}
            </Section>
          )}
          {education.length > 0 && (
            <Section title="Education">
              {education.map((ed) => (
                <div key={ed.id} className="r-block" style={{ marginBottom: 6 }}>
                  <div><strong>{ed.school}</strong></div>
                  {(ed.degree || ed.field) && <div style={{ color: "var(--rt-text-muted)" }}>{[ed.degree, ed.field].filter(Boolean).join(", ")}</div>}
                  <div style={{ color: "var(--rt-text-muted)", fontSize: 10.5 }}>{fmtRange(ed.start, ed.end)}</div>
                </div>
              ))}
            </Section>
          )}
          {certifications.length > 0 && (
            <Section title="Certifications">
              {certifications.map((c) => (
                <div key={c.id} className="r-block">{c.name}{c.issuer && ` — ${c.issuer}`}{c.date && ` (${c.date})`}</div>
              ))}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 16 }}>
      <h2 style={{
        fontSize: 11.5, margin: "0 0 8px", textTransform: "uppercase",
        letterSpacing: 1.5, color: "var(--rt-accent-dark)", fontWeight: 800,
      }}>{title}</h2>
      <div>{children}</div>
    </section>
  );
}
