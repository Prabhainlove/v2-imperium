# agents/

This folder holds **agents that run inside the local Python process**.

| File | Responsibility |
|------|----------------|
| `automation_agent.py` | Orchestrates a single job-application run: open Chrome → classify page → fill forms → wait for human approval → submit. |

## Where are the other agents?

To keep the project honest (no fake agents), the other roles are **not
duplicated here**. They live where their data lives — in the TanStack server
functions under `src/lib/imperium/brain/`:

| Role | Implementation |
|------|----------------|
| Resume agent | `src/lib/imperium/brain/resume-optimizer.server.ts` |
| Cover-letter agent | `src/lib/imperium/brain/cover-letter-generator.server.ts` |
| Job-search agent | `src/lib/imperium/sources.server.ts` + `brain/job-analysis.server.ts` |
| Application agent | `src/lib/imperium/brain/application-engine.server.ts` |
| Career / profile intelligence | `src/lib/imperium/brain/career-intelligence.server.ts`, `profile-analysis.server.ts` |

The local **automation_agent** is the only role that has to run on the
user's own machine, because it drives a real Chrome window via Selenium —
everything else runs server-side.
