# Imperium Local Automation Agent

A standalone Python service that runs on **your machine** and performs real
browser automation (Playwright + Chromium) for Imperium job applications.

It talks directly to your Supabase database — no cloud worker, no remote
broker. The frontend (running locally via `npm run dev`) sees live progress
because the same Supabase tables are realtime-published.

```
┌─────────────────────────────┐         ┌──────────────────────────────┐
│  Imperium frontend          │ realtime│  Local agent (this folder)   │
│  (Vite dev @ :3000)         │ ◀───────│  Python + Playwright Chrome  │
│  /autopilot page            │         │  polls automation_runs       │
└─────────────────────────────┘         └──────────────────────────────┘
                ▲                                   │
                │ Supabase (Postgres + Realtime)    │
                └───────────────────────────────────┘
```

## Setup

1. **Python 3.10+** required.

2. Install deps:
   ```bash
   cd IMPERIUM/local_agent
   python -m pip install -r requirements.txt
   python -m playwright install chromium
   ```

3. Create `IMPERIUM/local_agent/.env` (copy `.env.example`) and fill in:
   - `SUPABASE_URL`            — same as the frontend `VITE_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` — service-role key from your Supabase project
   - `IMPERIUM_AGENT_TOKEN`    — any string; must match what the frontend sends
   - `HEADLESS`                — `false` (default) to watch the browser

4. Run:
   ```bash
   python main.py
   ```

   You should see:
   ```
   [agent] Imperium local automation agent started
   [agent] Polling automation_runs every 2s …
   ```

5. Open the frontend at <http://localhost:3000/autopilot>, queue an
   application, and watch Chromium launch and drive the job page.

## What it does

- Polls `public.automation_runs` for rows where `status='queued'`.
- Opens Chromium (headed by default), navigates to `job_url`.
- Streams a fresh screenshot + step/action/url back to the row every ~1s.
- Pauses on `status='awaiting_approval'` until the user clicks **Approve**
  in the UI (frontend flips `approved=true`).
- Submits, then marks `status='submitted'`.

The agent never talks to Lovable infra. Everything runs on your laptop.
