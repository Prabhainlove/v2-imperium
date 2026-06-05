# Imperium Local Agent (offline)

A fully offline job-application automation agent. No Supabase, no cloud,
no API keys. It runs a local FastAPI server on `http://127.0.0.1:8000`
and drives a real, visible Chrome window via Selenium.

## Install & run

```bash
cd IMPERIUM/local_agent
python -m venv .venv && source .venv/bin/activate   # (Windows: .venv\Scripts\activate)
pip install -r requirements.txt
cp .env.example .env        # optional, defaults are fine
python main.py
```

You should see:

```
[agent] Imperium Local Agent (offline) — http://127.0.0.1:8000
```

## HTTP API

| Method | Path                | Body / Params                          | Description                             |
| ------ | ------------------- | -------------------------------------- | --------------------------------------- |
| GET    | `/health`           | —                                      | Liveness + Chrome readiness             |
| POST   | `/apply`            | `{ "job_url": "...", "profile": {…} }` | Queue a new application (returns `job_id`) |
| POST   | `/approve`          | `{ "job_id": "..." }`                  | Approve & submit current run            |
| POST   | `/reject`           | `{ "job_id": "..." }`                  | Reject current run                      |
| GET    | `/status/{job_id}`  | —                                      | Full run with events                    |
| GET    | `/events/{job_id}`  | —                                      | Just events (good for polling)          |
| GET    | `/runs`             | —                                      | All runs (most recent first)            |

State is kept in memory and mirrored to `agent_state.json` so runs survive restarts.

## Frontend wiring

The web app talks directly to `http://localhost:8000` — no Supabase calls
involved in the automation path. Override via `VITE_IMPERIUM_API_BASE_URL`
or the in-app settings.
