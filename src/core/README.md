# `src/core/` — Imperium Architecture (at a glance)

> 30-second mental model for reviewers.

```
User
 └── Job Agent              (src/core/agents/job_agent)
      ├── Brain             (src/core/brain)            ← reasoning + memory
      ├── Modules           (job_agent/modules/*)       ← jobs, resumes, cover letters, applications, interviews
      └── Automation Layer  (src/core/automation)       ← bridge to local Selenium
            └── Local Selenium Agent (IMPERIUM/local_agent, Python)
                 └── Browser
```

## What runs where

| Layer | Lives in | Runtime |
|-------|----------|---------|
| UI / pages | `src/routes/*` | Browser |
| Job Agent + modules | `src/core/agents/job_agent/**` (facade) → `src/lib/imperium/**` (impl) | TanStack server functions |
| Brain | `src/core/brain/**` (facade) → `src/lib/imperium/brain/**` (impl) | TanStack server functions |
| Automation bridge | `src/core/automation/**` | Browser → HTTP → local agent |
| Selenium Automation Agent | `IMPERIUM/local_agent/**` | Local Python process |

## Implemented vs future agents

| Agent | Status |
|-------|--------|
| **Job Agent** (`agents/job_agent`) | ✅ Implemented — every job-search workflow lives here as a module. |
| **Automation Agent** (`IMPERIUM/local_agent`) | ✅ Implemented — Selenium-driven, runs on the user's machine. |
| Research Agent (`agents/research_agent`) | 🟡 Future — placeholder only. |
| Code Agent (`agents/code_agent`) | 🟡 Future — placeholder only. |
| AutoGPT Agent (`agents/autogpt_agent`) | 🟡 Future — placeholder only. |

## Why facades instead of moving files

Every file under `src/core/` is a thin **re-export** of the existing
implementation in `src/lib/imperium/**`. This keeps every existing route,
import, and server function working **unchanged** while making the
architecture visible from the folder tree. There is no duplicated logic
and nothing to drift out of sync — `core/` is the map, `lib/imperium/` is
the territory.
