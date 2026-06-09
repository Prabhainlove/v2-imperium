/** Modern — sidebar layout. Left rail = contact + skills, right = content. */
import type { TemplateProps } from "./_shared";
import { fmtRange, pageStyle } from "./_shared";
import { themeVars } from "./themes";

export function ModernTemplate({ resume, theme }: TemplateProps) {
  const { personal, summary, skills, experience, projects, education, certifications, meta } = resume;
  return (
    <div
      className="resume-page resume-modern"
      style={{
        ...pageStyle(meta.paper),
        ...themeVars(theme),
        padding: 0,
        fontFamily: '"Inter", "Helvetica Neue", sans-serif',
        fontSize: 11.5,
        lineHeight: 1.5,
        display: "grid",
        gridTemplateColumns: "240px 1fr",
      }}
    >
      <aside style={{ background: "var(--rt-sidebar-bg)", color: "var(--rt-sidebar-text)", padding: "40px 22px" }}>
        <h1 style={{ fontSize: 22, margin: 0, fontWeight: 700, lineHeight: 1.15 }}>{personal.name || "Your Name"}</h1>
        {personal.title && <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>{personal.title}</div>}

        <SideBlock title="Contact">
          {personal.email && <div>{personal.email}</div>}
          {personal.phone && <div>{personal.phone}</div>}
          {personal.location && <div>{personal.location}</div>}
          {personal.links.map((l) => (
            <a key={l.url} href={l.url} style={{ color: "var(--rt-sidebar-text)", display: "block", opacity: 0.9 }}>{l.label}</a>
          ))}
        </SideBlock>

        {skills.length > 0 && (
          <SideBlock title="Skills">
            {skills.map((g) => (
              <div key={g.category} className="r-block" style={{ marginBottom: 8 }}>
                {skills.length > 1 && <div style={{ fontWeight: 600, fontSize: 10.5, opacity: 0.9, marginBottom: 2 }}>{g.category}</div>}
                <div style={{ fontSize: 11 }}>{g.items.join(", ")}</div>
              </div>
            ))}
          </SideBlock>
        )}

        {education.length > 0 && (
          <SideBlock title="Education">
            {education.map((ed) => (
              <div key={ed.id} className="r-block" style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 600 }}>{ed.school}</div>
                {(ed.degree || ed.field) && <div style={{ opacity: 0.9 }}>{[ed.degree, ed.field].filter(Boolean).join(", ")}</div>}
                <div style={{ opacity: 0.75, fontSize: 10.5 }}>{fmtRange(ed.start, ed.end)}</div>
              </div>
            ))}
          </SideBlock>
        )}

        {certifications.length > 0 && (
          <SideBlock title="Certifications">
            {certifications.map((c) => (
              <div key={c.id} className="r-block" style={{ marginBottom: 4 }}>
                <div style={{ fontWeight: 600 }}>{c.name}</div>
                {c.issuer && <div style={{ opacity: 0.85, fontSize: 10.5 }}>{c.issuer}{c.date && ` · ${c.date}`}</div>}
              </div>
            ))}
          </SideBlock>
        )}
      </aside>

      <main style={{ padding: "40px 36px" }}>
        {summary && <MainSection title="Profile"><p style={{ margin: 0 }}>{summary}</p></MainSection>}

        {experience.length > 0 && (
          <MainSection title="Experience">
            {experience.map((e) => (
              <div key={e.id} className="r-block" style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div>
                    <strong style={{ fontSize: 12.5 }}>{e.title}</strong>
                    {e.company && <span style={{ color: "var(--rt-accent)" }}> @ {e.company}</span>}
                  </div>
                  <span style={{ color: "var(--rt-text-muted)", fontSize: 11 }}>{fmtRange(e.start, e.end)}</span>
                </div>
                {e.location && <div style={{ fontStyle: "italic", color: "var(--rt-text-muted)", fontSize: 10.5 }}>{e.location}</div>}
                <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
                  {e.bullets.filter(Boolean).map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              </div>
            ))}
          </MainSection>
        )}

        {projects.length > 0 && (
          <MainSection title="Projects">
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
          </MainSection>
        )}
      </main>
    </div>
  );
}

function SideBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2, opacity: 0.7, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 11.5, lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

function MainSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 14 }}>
      <h2 style={{
        fontSize: 12, margin: "0 0 8px", textTransform: "uppercase",
        letterSpacing: 1.5, color: "var(--rt-accent-dark)", fontWeight: 700,
        borderBottom: `2px solid var(--rt-accent)`, paddingBottom: 4,
      }}>{title}</h2>
      <div>{children}</div>
    </section>
  );
}
