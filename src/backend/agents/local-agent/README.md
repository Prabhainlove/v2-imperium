# Imperium Local Agent (offline)

A fully offline job-application automation agent. No Supabase, no cloud,
no API keys, **no compiled dependencies**. Pure Python standard library
HTTP server (`http.server`) on `http://127.0.0.1:8000`, driving a real
visible Chrome window via Selenium. Optional local LLM via [Ollama](https://ollama.com)
makes form filling smarter — if Ollama isn't running, the agent falls
back to deterministic heuristics.

## Folder layout

```text
local_agent/
├── main.py                          # entrypoint shim — `python main.py` still works
├── api/
│   └── agent_server.py              # HTTP server (/health /apply /approve /reject ...)
├── agents/
│   ├── automation_agent.py          # run orchestrator (one job → done/approval)
│   └── README.md                    # where the other agents live (server-side)
├── automation/
│   ├── selenium_driver.py           # Chrome launch + profile management
│   ├── form_parser.py               # DOM snapshot + generic field filling
│   ├── resume_uploader.py           # resume file-input handler
│   └── workflow_executor.py         # LinkedIn / Greenhouse / Lever flows
├── shared/
│   ├── models.py                    # run registry + persistence
│   └── llm_brain.py                 # Ollama client (classify + answer)
├── storage/
│   └── application_history.json     # persisted runs (auto-created)
├── requirements.txt
└── .env.example
```

Every non-trivial file has a header comment with Purpose / Inputs /
Outputs / Responsibility so the architecture is defensible at a glance.

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
[agent] Imperium Local Agent (offline, stdlib) -- http://127.0.0.1:8000
[agent] Chrome ready: True | headless=False | state=storage/application_history.json
```

## Optional: smarter form filling via Ollama

```bash
# Install Ollama once from https://ollama.com, then:
ollama pull qwen2.5:7b      # recommended (~5 GB RAM)
# or for low-RAM machines:
ollama pull llama3.2:3b
```

The agent auto-detects Ollama at `http://127.0.0.1:11434`. If it's not
running, every call silently falls back to heuristics — the agent still
works, just less intelligently on free-text questions.

## HTTP API

| Method | Path                | Body / Params                            | Description                             |
| ------ | ------------------- | ---------------------------------------- | --------------------------------------- |
| GET    | `/health`           | —                                        | Liveness + Chrome readiness             |
| POST   | `/apply`            | `{ "job_url": "...", "profile": {…} }`   | Queue a new application (returns `job_id`) |
| POST   | `/approve`          | `{ "job_id": "..." }`                    | Approve & submit current run            |
| POST   | `/reject`           | `{ "job_id": "..." }`                    | Reject current run                      |
| GET    | `/status/{job_id}`  | —                                        | Full run with events                    |
| GET    | `/events/{job_id}`  | —                                        | Just events (good for polling)          |
| GET    | `/runs`             | —                                        | All runs (most recent first)            |

State is mirrored to `storage/application_history.json` so runs survive
restarts. If you previously ran the older single-file version, your
`agent_state.json` is loaded once on first start and then migrated.

## Frontend wiring

The web app talks directly to `http://localhost:8000` — no Supabase calls
involved in the automation path. Override via `VITE_IMPERIUM_API_BASE_URL`
or the in-app settings.
