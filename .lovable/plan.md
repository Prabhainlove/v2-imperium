# Resume Studio V2 — Rebuild Plan

A complete rebuild of `/resume` into a real-time, template-driven resume builder. Single source of truth = structured **Resume JSON**. Templates are pure React components. AI is optional (Ollama via existing `ModelRouter`) and only enhances — never blocks rendering.

---

## 1. Data Model (single source of truth)

New file: `src/backend/resume/ResumeSchema.ts` (client-safe, Zod).

```ts
ResumeJSON {
  personal: { name, title, email, phone, location, links[] }
  summary: string
  skills: { category, items[] }[]
  experience: { company, title, location, start, end, bullets[] }[]
  projects: { name, stack[], url, bullets[] }[]
  education: { school, degree, field, start, end, gpa, honors[] }[]
  certifications: { name, issuer, date, url }[]
  meta: { templateId, accentColor, font, paper: 'A4'|'Letter' }
}
```

- No more markdown-as-source-of-truth. Markdown editor edits a **derived view**; structured editor edits JSON directly.
- Zod-validated everywhere (load, save, AI output).
- Resume = `{ id, version, createdAt, json: ResumeJSON, atsCache }` persisted (localStorage now; DB later).

---

## 2. Folder Layout

```
src/frontend/resume/
  ResumePage.tsx                      ← shell (3-pane)
  resume.css
  state/
    useResumeStore.ts                 ← Zustand store (resume JSON + versions + selected template)
    useResumeAts.ts                   ← debounced ATS recompute (300ms)
  panes/
    EditorPane.tsx                    ← left: structured + markdown toggle
    PreviewPane.tsx                   ← center: live template render, A4 scaled
    InsightsPane.tsx                  ← right: ATS, keywords, versions, quick actions
  editor/
    StructuredEditor.tsx              ← form-based per-section editing
    MarkdownEditor.tsx                ← thin wrapper, parses to JSON on change
  templates/
    registry.ts                       ← id → component + metadata
    ClassicAts.tsx
    Professional.tsx
    Executive.tsx
    Modern.tsx
    Creative.tsx
    Developer.tsx
    Student.tsx
    Minimal.tsx
    _shared/                          ← Section, Bullet, DateRange, Sidebar primitives
  export/
    pdf.ts                            ← html2pdf via cloned preview node
    docx.ts                           ← docx library, schema-driven
  ai/
    summary.functions.ts              ← createServerFn → ModelRouter
    improve.functions.ts              ← bullet rewrite
    fillMissing.functions.ts          ← gap suggestions
    extractJD.functions.ts            ← JD → keywords/skills
  ats/
    AtsEngine.ts                      ← pure TS, deterministic scoring
```

---

## 3. Real-Time Rendering

- Zustand store holds `ResumeJSON`. Editor mutates store; PreviewPane subscribes; React re-renders only changed sections (memoized templates).
- No save button, no "regenerate". Auto-save to localStorage (debounced 500ms).
- Preview rendered at fixed A4/Letter dimensions inside a CSS `transform: scale()` container so it always looks like the exported page.
- Versions: snapshot store on user "Save as version" and on every export. Stored as compressed JSON in localStorage with `versions[]`.

---

## 4. Template Engine

`<Template id="modern" resume={resumeJSON} />` — pure React, no AI, no markdown.

8 templates at launch matching the references:
- **ClassicATS** — single-column, Arial, black/white, ATS-safe (matches Sheets/consulting refs)
- **Professional** — serif headers, rule lines (matches Sheets template)
- **Executive** — wide left margin, small caps
- **Modern** — two-column, accent color (Novoresume-like)
- **Creative** — sidebar w/ photo slot (Bronson/Baxter refs)
- **Developer** — mono accents, GitHub/links prominent
- **Student/Fresher** — projects-first (Whitehead ref)
- **Minimal** — Inter, lots of whitespace

Switching template = change `meta.templateId` only. Zero data loss.

---

## 5. ATS Engine (deterministic, no AI required)

`AtsEngine.ts` computes from `ResumeJSON` + JD:

| Metric | Method |
|---|---|
| ATS Score | weighted blend of below (0–100) |
| Keyword Match % | matched JD keywords / total JD keywords |
| Missing Keywords | JD keywords not in resume text |
| Section Completeness | required sections present |
| Formatting Safety | template flag + bullet length checks |
| Readability | Flesch on bullets+summary |
| Experience Quality | % bullets with action verb + metric |
| Project Quality | same heuristic for projects |
| Length | page estimate from char count + template density |
| Contact Completeness | email/phone/location/links present |

Recomputed via `useResumeAts` (debounced 300ms). Cached in store. No hardcoded numbers.

---

## 6. JD Intelligence

- JD text stored in store (`selectedJob.description`).
- `extractJD.functions.ts` (server fn → Ollama) returns `{ requiredSkills, keywords, technologies, softSkills, responsibilities }`. Cached by JD hash.
- Fallback: pure-TS extractor in `AtsEngine` (skill dictionary + n-gram TF) so the UI works without Ollama.
- InsightsPane shows matched/missing skills, missing keywords, optimization opportunities.

---

## 7. AI Features (Ollama via `ModelRouter`)

All as `createServerFn` in `src/backend/api/resume.api.ts`, never called from UI directly. Each takes `ResumeJSON` + JD, returns **schema-validated** JSON patches the user accepts/rejects.

1. **Generate Professional Summary** → returns `{ summary: string }`
2. **Complete My Resume** → returns suggestion list: `{ section, field, suggested, rationale }[]`
3. **Improve Resume** → returns `{ path, before, after, reason }[]` for weak bullets
4. JD extract (above)

Caching: keyed by `hash(resumeJSON) + hash(jd) + featureId`, stored in store + localStorage. Re-runs only when input hash changes.

---

## 8. Export

**PDF (WYSIWYG):**
- Clone the actual `PreviewPane` DOM node, render off-screen at exact A4/Letter px, then `html2pdf.js` with `pagebreak: { mode: ['css','legacy'] }` and `.resume-no-break` utility class on section blocks.
- Templates use `break-inside: avoid` on entry blocks → no overlap/clipping.
- Same fonts loaded via `@font-face` (self-hosted) so PDF matches preview.

**DOCX:**
- `docx` npm library. Schema-driven builder reading `ResumeJSON` (not HTML). Each template registers an optional DOCX renderer; default uses Classic mapping.

---

## 9. Page Layout (matches reference screenshot)

Top bar: Job chip · Match Score · Version selector · View JD button
Left (38%): Editor tabs [Structured | Markdown] + template picker
Center (40%): Live preview, zoom controls, device toggle
Right (22%): Resume Insights (ATS), Versions, Quick Actions
Bottom bar: Save status · Version History · Export PDF · Export DOCX · Generate with AI · Apply

---

## 10. Build Order (incremental, shippable each step)

1. Schema + Zustand store + localStorage persistence + seed from current profile
2. PreviewPane + ClassicATS template + StructuredEditor (real-time works end-to-end)
3. ATS engine + InsightsPane (deterministic, no AI)
4. Remaining 7 templates + template picker
5. PDF export (WYSIWYG) + DOCX export
6. Versioning + version history UI + diff
7. Ollama serverFns (summary, improve, fill-missing, JD extract) with accept/reject UI
8. Markdown editor view (derived) + polish

---

## 11. Out of Scope (this plan)

- DB persistence (kept in localStorage; easy to swap later)
- Cover letters
- Marketplace UI for templates (architecture supports it; UI later)
- Collaborative editing

---

## Acceptance

All criteria from the brief: real-time render, 8 templates, genuine ATS, JD intel, summary/improve/fill-missing, versions, template switch with no data loss, PDF == preview, working DOCX, Ollama via ModelRouter, runs in Lovable Preview and locally with no cloud AI dependency.

Approve to start with **Step 1–3** (schema, store, preview, ClassicATS template, structured editor, ATS engine). Remaining steps land in follow-up turns to keep diffs reviewable.
