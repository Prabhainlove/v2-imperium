# Fix: UI shows "Local agent not reachable" even though `/health` works

## Root cause

Two independent bugs, both in `src/routes/_authenticated/autopilot.tsx`:

1. **Raw `fetch` bypasses the shared bridge.** That route calls
   `fetch(${agentUrl}/health)`, `/status/{id}`, `/apply`, `/approve`, `/reject`
   directly. It does NOT use `src/core/automation/selenium_bridge.ts`, which
   was updated in B10 to inject `Authorization: Bearer ${VITE_LOCAL_AGENT_TOKEN}`.
   So:
   - `/health` is public → request succeeds at network level, but
   - the agent's CORS allowlist (`IMPERIUM_ALLOWED_ORIGINS`) defaults to
     `localhost:3000/5173` only. The Lovable preview origin
     (`https://id-preview--…lovable.app`) is not in that list, so the
     browser rejects the response → `fetch` throws → `agentOnline=false` →
     toast: *"Local agent is not reachable at http://127.0.0.1:8000"*.
   - `/status`, `/apply`, `/approve`, `/reject` would additionally 401 because
     no bearer header is sent.

2. **`HealthBadge`** uses a different code path (server function `getHealth`,
   not the local agent), so it's unaffected — only Autopilot is broken.

## Fix scope (frontend only — no architecture change)

### Code changes — `src/routes/_authenticated/autopilot.tsx`

Replace the four raw `fetch` calls with the existing bridge helpers from
`@/core/automation/selenium_bridge`:

| Current raw call                       | Replace with                       |
| -------------------------------------- | ---------------------------------- |
| `fetch(${agentUrl}/health)`            | `localAgentHealth()`               |
| `fetch(${agentUrl}/status/${jobId})`   | `localAgentStatus(jobId)`          |
| `fetch(${agentUrl}/apply, POST …)`     | `localAgentApply(jobUrl, profile)` |
| `fetch(${agentUrl}/${approve/reject})` | `localAgentApprove/Reject(jobId)`  |

Side effects of this swap:
- Bearer token (`VITE_LOCAL_AGENT_TOKEN`) is sent automatically on every call.
- Base URL comes from `VITE_LOCAL_AGENT_URL`, matching `HealthBadge`.
- The `agentUrl` input/localStorage UI becomes display-only (kept for the
  toast message and to show the active endpoint). The actual URL used is
  the env var — this is correct behavior and matches B10.

Improve the failure toast to include the underlying error message
(e.g. `"…not reachable: TypeError: Failed to fetch (likely CORS or token)"`)
so future diagnosis is faster.

### Config — documented, not auto-applied

If the user is testing from the hosted preview origin, the local agent must
allow it. In `IMPERIUM/local_agent/.env`:

```
IMPERIUM_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,https://id-preview--e08b44e8-6dfc-4394-93d9-758fc1640314.lovable.app
VITE_LOCAL_AGENT_TOKEN=<same value as IMPERIUM_AGENT_TOKEN>
```

Then restart the local agent. No code change required for this — just a
note in the post-fix report.

## Files modified

- `src/routes/_authenticated/autopilot.tsx` — swap raw fetches for
  `selenium_bridge` helpers; richer error toast.

## Out of scope (per user's directive)

- No changes to `selenium_bridge.ts`, agent_server.py, or routing.
- No changes to `HealthBadge` (already correct).
- No new endpoints, no architectural changes.

## Validation

1. With agent running locally AND `VITE_LOCAL_AGENT_TOKEN` set in web `.env`
   AND preview origin in `IMPERIUM_ALLOWED_ORIGINS`:
   - Open `/autopilot` → green "agent online" indicator within 5s.
   - Queue a job URL → `/apply` returns `{job_id}` and polling starts.
2. With token missing → toast shows 401 message (not generic "unreachable").
3. With origin missing from allowlist → toast shows CORS-style fetch error.
