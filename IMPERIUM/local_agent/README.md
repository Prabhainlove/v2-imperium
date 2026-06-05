# Imperium Local Automation Agent (Selenium)

A local Python agent that watches your Supabase `automation_runs` table and
drives a real Chrome window to fill and submit job applications on your
machine. Every action is streamed back to the web app in real time — no
screenshots, just live structured events you can watch on `/autopilot`.

## Prerequisites

- Python 3.10+
- Google Chrome installed (the agent uses `undetected-chromedriver`,
  which downloads the matching ChromeDriver automatically).

## Setup

```bash
cd IMPERIUM/local_agent
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env and fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, IMPERIUM_AGENT_TOKEN
python main.py
```

## .env

```
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>
IMPERIUM_AGENT_TOKEN=local-dev-token
HEADLESS=0              # 0 = watch Chrome live, 1 = run hidden
POLL_SECONDS=3
```

The same `IMPERIUM_AGENT_TOKEN` must be entered on the **Autopilot** page in
the web app — that's how a queued run knows which agent should pick it up.

## How it works

1. You queue an application from the web app (`/autopilot` page).
2. This agent polls Supabase every 3 seconds for `status='queued'` rows
   with a matching `agent_token`.
3. When it picks one up, it opens Chrome **visibly** (so you can watch),
   navigates to the job URL, scans every form field, and fills the ones it
   recognises from your profile (name, email, phone, location, links…).
4. Each fill is streamed to `automation_events` and appears live in the
   web UI as it happens.
5. The agent then waits for you to click **Approve & submit** (or
   **Reject**) on the web page. Once approved it clicks the submit
   button and marks the run as `submitted`.

## Troubleshooting

- **"No module named selenium"** → activate the virtualenv first.
- **Chrome doesn't launch** → make sure Chrome is installed; on Linux
  install `google-chrome-stable` from Google's repo.
- **Run stays "queued"** → the `IMPERIUM_AGENT_TOKEN` in `.env` doesn't
  match the token in the web UI. Re-enter it on `/autopilot` and try again.
- **Live events not showing** → confirm the same Supabase project URL in
  both the agent `.env` and the web app's `.env` (`VITE_SUPABASE_URL`).
