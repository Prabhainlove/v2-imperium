# Frontend Completion Plan — Local Agent, Profile Nav, Interviews

## 1. Navbar updates (`src/frontend/shell/ImperiumNavbar.tsx`)

- Rename `Autopilot` → `Local Agent` (route stays `/autopilot`, icon stays IconSparkle).
- Replace `Recruiters` entry with `Profile` pointing to `/profile` (icon: IconScan or a user-style icon already exported).
- Keep all other entries as-is. No backend touched.

## 2. Local Agent Control Center UI (`src/frontend/autopilot/AutopilotPage.tsx` + `autopilot.css`)

Build the UI from the reference screenshot, fully Imperium-branded (no Tech Mahindra / LinkedIn copy unless representing live target portal status), pure frontend with mock state via `useState`. Layout:

- **Header**: "Local Agent Control Center" + subtitle "AI Powered • Local Execution • Real Browser Automation", live clock, bot avatar.
- **Status strip** (4 cards): Local Agent ONLINE, Ollama (qwen3:8b) CONNECTED, Browser (Chrome) CONNECTED, System Status HEALTHY. Green dot indicators.
- **New Agent Task panel**: Paste Job URL input + `Start Agent` button; Quick Actions row (Open Job URL, Apply to Job, Upload Resume, Fill Application).
- **Agent Execution Steps** list (7 steps with status icons + timestamps), driven by local state so steps animate from Pending → In Progress → Done when `Start Agent` is clicked (pure frontend simulation with `setTimeout`).
- **Task Summary card**: Task Type, Portal, Job Title, Company, Status pill, Started At, Elapsed Time (ticking), Resume file chip, Form Profile chip.
- **Live Browser (Chrome) panel** on the right: faux chrome window with tab, address bar, and a mocked job posting view (Imperium-branded sample: e.g., "Frontend Engineer" at "Imperium Labs") + Apply/Save buttons + About the job text.
- **Portal Status card** beneath: Website, Current URL, Page Status, Detection, Next Action.
- **Log Console** (bottom-left) with sample lines + Clear Log / Download Log buttons (frontend only).
- **Agent Controls** (bottom-right): Pause Agent, Reset Task, Stop Agent buttons wired to local state.

Styling: dark theme matching screenshot using existing tracker design tokens / Tailwind; rounded cards, subtle borders, green/violet accent. Responsive: stack columns under `lg`. No backend calls — TODO comments mark where `localAgentApi` will plug in later.

## 3. Profile route reuse

- `/profile` route already exists and renders `ProfilePage`. No changes needed; navbar entry just points there. Verify Profile page renders correctly; if it shows an "Up next" / unrelated placeholder, leave content as-is (out of scope — already built).

## 4. Interviews page UI (`src/frontend/interviews/InterviewsPage.tsx` + `interviews.css`)

Replace placeholder with a complete Interview Coach UI (frontend only):

- **Header**: "Interview Studio" + subtitle.
- **KPI row**: Upcoming, Completed, Avg Score, Practice Hours.
- **Upcoming Interviews list**: cards with company, role, date/time, round type (Technical/HR/System Design), Join + Prep buttons. Sourced from existing applications store if cheap, else local mock.
- **Practice Library**: grid of practice modes — Behavioral, DSA, System Design, Resume Walkthrough, HR Round — each card with "Start Session" CTA.
- **Recent Sessions** table: Date, Mode, Score, Duration, Review link.
- **AI Coach side panel**: tip-of-the-day + Start Mock Interview CTA (opens a placeholder modal — pure frontend).

Imperium-branded copy throughout.

## 5. Content sanity pass

Grep for stray reference-image strings ("Tech Mahindra", "Bengaluru, Karnataka", any non-Imperium brand wording) introduced by this work and replace with Imperium-flavored sample content (e.g., "Imperium Labs", "Remote / San Francisco").

## Out of scope

- No backend wiring, no schema, no store changes.
- No changes to Applications Tracker, Jobs, Resume, Dashboard pages.
- Real Local Agent integration is deferred — UI exposes a stable surface for it later.

## Acceptance

- Navbar shows: Dashboard, Jobs, Resume, Tracker, **Local Agent**, Interviews, **Profile**.
- `/autopilot` renders the full Local Agent Control Center matching reference layout.
- `/interviews` renders complete Interview Studio UI.
- `/profile` opens from navbar Profile link.
- No backend/store edits; build passes.
- in application tracker i find arjunkumar name make sure total application tracker have impeium content 
- in resume studio apply button is missing . 
- make sure total frontend contains only imperium content 