/** Markdown view of the resume + collapsible structured form for editing. */
import { useMemo, useState } from "react";
import { useResumeStore } from "@frontend/resume/state/useResumeStore";
import { uid } from "@frontend/resume/schema";
import { resumeToMarkdown } from "@frontend/resume/utils/resumeMarkdown";

export function EditorPane() {
  const resume = useResumeStore((s) => s.resume);
  const [structured, setStructured] = useState(false);

  const md = useMemo(() => resumeToMarkdown(resume), [resume]);
  const lines = md.split("\n");
  const words = md.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="rs-editor">
      <div className="rs-editor-tabs">
        <div className="rs-editor-tab is-active">
          <span aria-hidden>📄</span> resume.md
          <span className="rs-editor-tab-caret" aria-hidden>▾</span>
        </div>
        <div className="rs-editor-tools">
          <button className="rs-editor-tool" aria-label="Undo">↶</button>
          <button className="rs-editor-tool" aria-label="Redo">↷</button>
          <span className="rs-editor-saved">
            Auto-saved 2s ago <span className="rs-editor-saved-dot" />
          </span>
        </div>
      </div>

      {!structured ? (
        <div className="rs-editor-code">
          <pre className="rs-editor-gutter" aria-hidden>
            {lines.map((_, i) => (
              <span key={i}>{String(i + 1).padStart(2, " ")}</span>
            ))}
          </pre>
          <pre className="rs-editor-source">
            {lines.map((l, i) => (
              <span key={i} className={lineClass(l)}>{l || " "}{"\n"}</span>
            ))}
          </pre>
        </div>
      ) : (
        <StructuredEditor />
      )}

      <div className="rs-editor-footer">
        <button
          className="rs-editor-footer-toggle"
          onClick={() => setStructured((s) => !s)}
        >
          {structured ? "View markdown" : "Edit fields"}
        </button>
        <div className="rs-editor-footer-meta">
          <span>Lines 1–{lines.length}</span>
          <span>· Markdown ⓘ</span>
          <span>· {words} words</span>
        </div>
      </div>
    </div>
  );
}

function lineClass(l: string): string {
  if (l.startsWith("# ")) return "rs-md-h1";
  if (l.startsWith("## ")) return "rs-md-h2";
  if (l.startsWith("### ")) return "rs-md-h3";
  if (l.startsWith("- ")) return "rs-md-li";
  return "";
}

/* --------------- Structured edit form (collapsible) --------------- */
function StructuredEditor() {
  const resume = useResumeStore((s) => s.resume);
  const patch = useResumeStore((s) => s.patch);

  return (
    <div className="rs-editor-fields">
      <Section title="Personal">
        <Field label="Name" value={resume.personal.name} onChange={(v) => patch((r) => { r.personal.name = v; })} />
        <Field label="Title" value={resume.personal.title} onChange={(v) => patch((r) => { r.personal.title = v; })} />
        <div className="rs-field-row">
          <Field label="Email" value={resume.personal.email} onChange={(v) => patch((r) => { r.personal.email = v; })} />
          <Field label="Phone" value={resume.personal.phone} onChange={(v) => patch((r) => { r.personal.phone = v; })} />
        </div>
        <Field label="Location" value={resume.personal.location} onChange={(v) => patch((r) => { r.personal.location = v; })} />
      </Section>

      <Section title="Summary">
        <textarea
          className="rs-field-input rs-field-textarea"
          rows={4}
          value={resume.summary}
          onChange={(e) => patch((r) => { r.summary = e.target.value; })}
        />
      </Section>

      <Section title="Skills">
        {resume.skills.map((g, gi) => (
          <div key={gi} className="rs-field-row">
            <input
              className="rs-field-input"
              value={g.category}
              onChange={(e) => patch((r) => { r.skills[gi].category = e.target.value; })}
            />
            <input
              className="rs-field-input"
              value={g.items.join(", ")}
              onChange={(e) => patch((r) => { r.skills[gi].items = e.target.value.split(",").map((s) => s.trim()).filter(Boolean); })}
            />
            <button className="rs-field-x" onClick={() => patch((r) => { r.skills.splice(gi, 1); })}>×</button>
          </div>
        ))}
        <button className="rs-field-add" onClick={() => patch((r) => { r.skills.push({ category: "Skills", items: [] }); })}>+ Add skill group</button>
      </Section>

      <Section title="Experience">
        {resume.experience.map((e, ei) => (
          <div key={e.id} className="rs-field-card">
            <div className="rs-field-row">
              <Field label="Title" value={e.title} onChange={(v) => patch((r) => { r.experience[ei].title = v; })} />
              <Field label="Company" value={e.company} onChange={(v) => patch((r) => { r.experience[ei].company = v; })} />
            </div>
            <div className="rs-field-row">
              <Field label="Start" value={e.start} onChange={(v) => patch((r) => { r.experience[ei].start = v; })} />
              <Field label="End" value={e.end} onChange={(v) => patch((r) => { r.experience[ei].end = v; })} />
            </div>
            {e.bullets.map((b, bi) => (
              <div key={bi} className="rs-field-row">
                <textarea
                  className="rs-field-input rs-field-textarea"
                  rows={2}
                  value={b}
                  onChange={(ev) => patch((r) => { r.experience[ei].bullets[bi] = ev.target.value; })}
                />
                <button className="rs-field-x" onClick={() => patch((r) => { r.experience[ei].bullets.splice(bi, 1); })}>×</button>
              </div>
            ))}
            <button className="rs-field-add rs-field-add-sm" onClick={() => patch((r) => { r.experience[ei].bullets.push(""); })}>+ Bullet</button>
            <button className="rs-field-remove" onClick={() => patch((r) => { r.experience.splice(ei, 1); })}>Remove</button>
          </div>
        ))}
        <button className="rs-field-add" onClick={() => patch((r) => { r.experience.push({ id: uid("exp"), company: "", title: "", location: "", start: "", end: "", bullets: [""] }); })}>+ Add experience</button>
      </Section>

      <Section title="Education">
        {resume.education.map((ed, idx) => (
          <div key={ed.id} className="rs-field-card">
            <div className="rs-field-row">
              <Field label="School" value={ed.school} onChange={(v) => patch((r) => { r.education[idx].school = v; })} />
              <Field label="Degree" value={ed.degree} onChange={(v) => patch((r) => { r.education[idx].degree = v; })} />
            </div>
            <div className="rs-field-row">
              <Field label="Field" value={ed.field} onChange={(v) => patch((r) => { r.education[idx].field = v; })} />
              <Field label="End" value={ed.end} onChange={(v) => patch((r) => { r.education[idx].end = v; })} />
            </div>
            <button className="rs-field-remove" onClick={() => patch((r) => { r.education.splice(idx, 1); })}>Remove</button>
          </div>
        ))}
        <button className="rs-field-add" onClick={() => patch((r) => { r.education.push({ id: uid("edu"), school: "", degree: "", field: "", start: "", end: "", gpa: "" }); })}>+ Add education</button>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rs-field-section">
      <h3 className="rs-field-section-title">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="rs-field">
      <label className="rs-field-label">{label}</label>
      <input className="rs-field-input" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
