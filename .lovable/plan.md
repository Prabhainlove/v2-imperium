# Full local rebuild — Resume, Cover Letter, Selenium, Live Streaming

This is a large change. I'm splitting it into 4 work packages. Confirm and I ship all of them in one pass.

## 1. Resume Studio — true ATS templates + PDF

**Replace** `src/lib/imperium/rendercv.server.ts` and `resume-render.ts` with three real ATS templates modeled on your screenshots:

- **Classic** (Resume Worded style): single column, Times/Calibri, `# Name`, contact line, ALL CAPS section headings with bottom border, right-aligned dates, bulleted achievements. ATS-safe — no tables, no columns, no icons.
- **Modern** (Andrew Clark style): single column, sans-serif, role title under name, section bars. Still ATS-safe (no sidebar text — sidebar info inlined as a "Skills" section so parsers read it).
- **Compact** (Pranhuti Singh / LaTeX style): tight spacing, smaller headings, dense bullets.

**PDF generation (local, no markdown download):**
- Add `jspdf` + `html2canvas` (pure browser, works fully local).
- New component `src/components/imperium/resume-renderer.tsx` renders the template as real HTML/CSS in a hidden A4-sized div.
- "Download PDF" button captures that node with html2canvas → jsPDF → multi-page A4. Markdown download removed everywhere.
- Same renderer used for live preview iframe → what you see is what downloads.

**Demo profile:**
- New server fn `seedDemoProfile` populates the profile + a sample job + a generated application with the "First Last / Financial Data Analyst" data from your screenshot, so the studio is never empty on a fresh install.
- Button in Settings → "Load demo profile".

**Live editing:**
- Resume Studio gets a left-pane form (name, contact, sections, bullets — add/remove/reorder) and a right-pane PDF-styled preview that updates on every keystroke (no save round-trip).
- Save button persists to Supabase; preview is always live from local state.

## 2. Cover Letter — new format

Rewrite `cover-letter-generator.server.ts` template to match the Luisa Hernandez screenshot:
- Header block: name + title, right-aligned contact (3 lines).
- "Dear Hiring Manager," → 3 short paragraphs (hook / proof / close) → "Sincerely, Name".
- Same PDF pipeline (jspdf + html2canvas) — `.pdf` download, no `.md`.
- Live edit pane mirrors Resume Studio.

## 3. Selenium agent (replaces Playwright)

- Delete `IMPERIUM/local_agent/` Playwright code.
- New `IMPERIUM/local_agent/`:
  - `main.py` — FastAPI server, polls Supabase for queued applications.
  - `selenium_driver.py` — undetected-chromedriver, visible window (`headless=False` by default so you watch it apply).
  - `form_filler.py` — field detection by label/placeholder/name, fills from profile, handles file upload (resume PDF), submits.
  - `requirements.txt`: `selenium`, `undetected-chromedriver`, `webdriver-manager`, `fastapi`, `uvicorn`, `supabase`, `python-dotenv`.
  - `README.md`: `pip install -r requirements.txt && python main.py`.
- Remove every reference to "playwright" / `chromium` from docs and code.

## 4. Live activity stream (no screenshots)

- New table `agent_events` (application_id, ts, kind, message, field, value).
- Selenium agent inserts a row for every action: `nav`, `field_filled`, `dropdown_selected`, `file_uploaded`, `submit_clicked`, `success`.
- Supabase Realtime subscription in `src/routes/_authenticated/applications.tsx` → new "Live Activity" drawer streams events as they arrive: "Filled 'Email' = you@x.com", "Uploaded resume.pdf", "Clicked Submit".
- Same stream surfaced on `/activity` route as a global live feed.
- Resume Studio live-edit preview already real-time (Section 1).

## Files touched (high level)
- **Add**: `src/components/imperium/resume-renderer.tsx`, `cover-letter-renderer.tsx`, `live-activity-stream.tsx`; `IMPERIUM/local_agent/{main.py,selenium_driver.py,form_filler.py}`; migration for `agent_events`.
- **Rewrite**: `resume.tsx`, `cover-letters.tsx`, `master-resume-studio.tsx`, `rendercv.server.ts`, `cover-letter-generator.server.ts`, `resume-render.ts`, `applications.tsx`, `activity.tsx`.
- **Delete**: old Playwright files, all `.md` download paths.
- **Deps add**: `jspdf`, `html2canvas`.

## Caveats (be honest)
- html2canvas-based PDFs are pixel-perfect but slightly larger files than text PDFs. They render *exactly* what the preview shows — best fit for "what I see is what I download".
- Selenium with `undetected-chromedriver` is local-only by design (opens a visible Chrome on your machine). It cannot run inside the Lovable preview sandbox — that's why "live applying" only works when you run the agent on your laptop. The web app shows the live event stream regardless.
- Demo profile writes to your real Supabase user — can be cleared with a "Reset demo" button.

**Confirm "go" and I execute all 4 packages in one pass.**
