/** Structured editor — every keystroke updates the store, the preview reflects instantly. */
import { useResumeStore } from "@frontend/resume/state/useResumeStore";
import { uid } from "@frontend/resume/schema";
import { TEMPLATES } from "@frontend/resume/templates/registry";
import { THEMES } from "@frontend/resume/templates/themes";

export function EditorPane() {
  const resume = useResumeStore((s) => s.resume);
  const patch = useResumeStore((s) => s.patch);
  const setTemplate = useResumeStore((s) => s.setTemplate);
  const setTheme = useResumeStore((s) => s.setTheme);

  return (
    <div className="resume-editor">
      <div className="resume-editor-section">
        <div className="resume-editor-section-title">Template</div>
        <div className="resume-template-gallery">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`resume-template-card${resume.meta.templateId === t.id ? " is-active" : ""}`}
              onClick={() => setTemplate(t.id)}
            >
              <div className="resume-template-card-name">{t.name}</div>
              <div className="resume-template-card-meta">
                <span>ATS {t.atsCompatibility}</span>
                <span>·</span>
                <span>Visual {t.visualAppeal}</span>
              </div>
              <div className="resume-template-card-best">{t.bestFor.slice(0, 2).join(" · ")}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="resume-editor-section">
        <div className="resume-editor-section-title">Theme</div>
        <div className="resume-theme-row">
          {THEMES.map((th) => (
            <button
              key={th.id}
              type="button"
              title={th.name}
              aria-label={th.name}
              className={`resume-theme-swatch${resume.meta.themeId === th.id ? " is-active" : ""}`}
              style={{ background: th.accent }}
              onClick={() => setTheme(th.id)}
            />
          ))}
        </div>
      </div>

      <Section title="Personal">
        <Field label="Name" value={resume.personal.name} onChange={(v) => patch((r) => { r.personal.name = v; })} />
        <Field label="Title" value={resume.personal.title} onChange={(v) => patch((r) => { r.personal.title = v; })} />
        <div className="resume-editor-row">
          <Field label="Email" value={resume.personal.email} onChange={(v) => patch((r) => { r.personal.email = v; })} />
          <Field label="Phone" value={resume.personal.phone} onChange={(v) => patch((r) => { r.personal.phone = v; })} />
        </div>
        <Field label="Location" value={resume.personal.location} onChange={(v) => patch((r) => { r.personal.location = v; })} />
      </Section>

      <Section title="Summary">
        <textarea
          className="resume-editor-input resume-editor-textarea"
          rows={4}
          value={resume.summary}
          onChange={(e) => patch((r) => { r.summary = e.target.value; })}
        />
      </Section>

      <Section title="Skills">
        {resume.skills.map((g, gi) => (
          <div key={gi} className="resume-editor-row">
            <input
              className="resume-editor-input"
              value={g.category}
              placeholder="Category"
              onChange={(e) => patch((r) => { r.skills[gi].category = e.target.value; })}
            />
            <input
              className="resume-editor-input"
              value={g.items.join(", ")}
              placeholder="comma, separated, items"
              onChange={(e) => patch((r) => { r.skills[gi].items = e.target.value.split(",").map((s) => s.trim()).filter(Boolean); })}
            />
            <button className="resume-editor-icon" onClick={() => patch((r) => { r.skills.splice(gi, 1); })}>×</button>
          </div>
        ))}
        <button className="resume-editor-add" onClick={() => patch((r) => { r.skills.push({ category: "Skills", items: [] }); })}>+ Add skill group</button>
      </Section>

      <Section title="Experience">
        {resume.experience.map((e, ei) => (
          <div key={e.id} className="resume-editor-card">
            <div className="resume-editor-row">
              <Field label="Title" value={e.title} onChange={(v) => patch((r) => { r.experience[ei].title = v; })} />
              <Field label="Company" value={e.company} onChange={(v) => patch((r) => { r.experience[ei].company = v; })} />
            </div>
            <div className="resume-editor-row">
              <Field label="Start" value={e.start} onChange={(v) => patch((r) => { r.experience[ei].start = v; })} />
              <Field label="End" value={e.end} onChange={(v) => patch((r) => { r.experience[ei].end = v; })} placeholder="Present" />
              <Field label="Location" value={e.location} onChange={(v) => patch((r) => { r.experience[ei].location = v; })} />
            </div>
            <Bullets
              value={e.bullets}
              onChange={(b) => patch((r) => { r.experience[ei].bullets = b; })}
            />
            <button className="resume-editor-remove" onClick={() => patch((r) => { r.experience.splice(ei, 1); })}>Remove</button>
          </div>
        ))}
        <button className="resume-editor-add" onClick={() => patch((r) => { r.experience.push({ id: uid("exp"), company: "", title: "", location: "", start: "", end: "", bullets: [""] }); })}>+ Add experience</button>
      </Section>

      <Section title="Projects">
        {resume.projects.map((p, pi) => (
          <div key={p.id} className="resume-editor-card">
            <div className="resume-editor-row">
              <Field label="Name" value={p.name} onChange={(v) => patch((r) => { r.projects[pi].name = v; })} />
              <Field label="URL" value={p.url} onChange={(v) => patch((r) => { r.projects[pi].url = v; })} />
            </div>
            <Field label="Stack (comma separated)" value={p.stack.join(", ")} onChange={(v) => patch((r) => { r.projects[pi].stack = v.split(",").map((s) => s.trim()).filter(Boolean); })} />
            <Bullets value={p.bullets} onChange={(b) => patch((r) => { r.projects[pi].bullets = b; })} />
            <button className="resume-editor-remove" onClick={() => patch((r) => { r.projects.splice(pi, 1); })}>Remove</button>
          </div>
        ))}
        <button className="resume-editor-add" onClick={() => patch((r) => { r.projects.push({ id: uid("prj"), name: "", stack: [], url: "", bullets: [""] }); })}>+ Add project</button>
      </Section>

      <Section title="Education">
        {resume.education.map((ed, idx) => (
          <div key={ed.id} className="resume-editor-card">
            <div className="resume-editor-row">
              <Field label="School" value={ed.school} onChange={(v) => patch((r) => { r.education[idx].school = v; })} />
              <Field label="Degree" value={ed.degree} onChange={(v) => patch((r) => { r.education[idx].degree = v; })} />
            </div>
            <div className="resume-editor-row">
              <Field label="Field" value={ed.field} onChange={(v) => patch((r) => { r.education[idx].field = v; })} />
              <Field label="GPA" value={ed.gpa} onChange={(v) => patch((r) => { r.education[idx].gpa = v; })} />
            </div>
            <div className="resume-editor-row">
              <Field label="Start" value={ed.start} onChange={(v) => patch((r) => { r.education[idx].start = v; })} />
              <Field label="End" value={ed.end} onChange={(v) => patch((r) => { r.education[idx].end = v; })} />
            </div>
            <button className="resume-editor-remove" onClick={() => patch((r) => { r.education.splice(idx, 1); })}>Remove</button>
          </div>
        ))}
        <button className="resume-editor-add" onClick={() => patch((r) => { r.education.push({ id: uid("edu"), school: "", degree: "", field: "", start: "", end: "", gpa: "" }); })}>+ Add education</button>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="resume-editor-section">
      <h3 className="resume-editor-section-title">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="resume-editor-field">
      <label className="resume-editor-label">{label}</label>
      <input className="resume-editor-input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Bullets({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="resume-editor-bullets">
      {value.map((b, i) => (
        <div key={i} className="resume-editor-bullet-row">
          <textarea
            className="resume-editor-input resume-editor-textarea"
            rows={2}
            value={b}
            placeholder="Action verb + what + outcome / metric"
            onChange={(e) => {
              const next = value.slice();
              next[i] = e.target.value;
              onChange(next);
            }}
          />
          <button className="resume-editor-icon" onClick={() => onChange(value.filter((_, idx) => idx !== i))}>×</button>
        </div>
      ))}
      <button className="resume-editor-add resume-editor-add-sm" onClick={() => onChange([...value, ""])}>+ Add bullet</button>
    </div>
  );
}
