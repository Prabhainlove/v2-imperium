# Resume Studio Re-skin — Build Plan

You picked **Professional (closest to reference)** + zoom controls. Here's what I'll ship. Frontend only — no backend, store, or schema changes.

## Files

**New**
- `src/frontend/resume/utils/resumeMarkdown.ts` — serialize `ResumeJSON` → markdown view for the editor
- `src/frontend/resume/panes/ActionBar.tsx` — sticky bottom bar (saved indicator, Version History, Save, Export PDF, Export DOCX, Generate with AI, Apply)

**Rewritten**
- `src/frontend/resume/ResumePage.tsx` — top bar (Back · company chip · Match Score · Version dropdown · View JD), three columns, bottom ActionBar, JD modal, hidden PrintRenderer
- `src/frontend/resume/panes/EditorPane.tsx` — `resume.md` tab with line numbers + syntax-tinted markdown; "Edit fields" toggle reveals the existing structured form
- `src/frontend/resume/panes/PreviewPane.tsx` — adds zoom toolbar (− / Fit ↔ 100% / +) and desktop/mobile device toggle
- `src/frontend/resume/panes/InsightsPane.tsx` — collapses to three cards: **Resume Insights** (ATS ring + Keywords matched bar + Missing-keyword red pills), **Resume Versions** (radio list with latest highlighted), **Quick Actions** (Tailor for Another Job)
- `src/frontend/resume/resume.css` — full rewrite under a new `rs-*` namespace with tokens: bg `#f7f8fa`, card `#fff`, border `#e6e8ee`, indigo `#4f46e5→#7c3aed`, success `#10b981`, danger `#fee2e2/#dc2626`, Inter + JetBrains Mono, 12px card radius, soft shadows, A4 paper shadow

## Content swaps (no Google / Zoho / Dinesh)
- Default `selectedJob` in `useResumeStore` → **Imperium Labs · Senior Frontend Engineer** with a frontend-focused JD (TypeScript, React, Next.js, design systems, performance). Existing persisted store keeps the user's selected job; only the seed default changes.
- All visible strings tied to the resume come from the live store (already Imperium-seeded via `SAMPLE_PROFILE`).

## Wiring preserved
- Save, Export PDF/DOCX, Generate with AI, Apply → reuse existing engines/handlers; only moved into ActionBar
- Apply still calls `createFromResumeStudio` then routes to `/applications`
- ATS / JD-Match / Skill-Gap engines feed the new Insights card unchanged
- Version restore wired to the new list

## Out of scope
ATS engine, AI server functions, templates, store, schema, applications module.

Approve to build.
