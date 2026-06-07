## Environment Variable Setup for Local Agent Connection

No code changes. Two files to update with the values below.

### 1. Project root `.env`

Add these three lines (or update if present):

```
VITE_LOCAL_AGENT_URL=http://127.0.0.1:8000
VITE_LOCAL_AGENT_TOKEN=<PASTE_TOKEN_A>
IMPERIUM_CALLBACK_SECRET=<PASTE_TOKEN_B>
```

After saving, the Vite dev server must be restarted so `VITE_*` values are re-bundled into the browser code.

### 2. `IMPERIUM/local_agent/.env`

Create (or update) with:

```
IMPERIUM_AGENT_TOKEN=<PASTE_TOKEN_A>            # MUST equal VITE_LOCAL_AGENT_TOKEN
IMPERIUM_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,https://id-preview--e08b44e8-6dfc-4394-93d9-758fc1640314.lovable.app
IMPERIUM_CALLBACK_URL=https://id-preview--e08b44e8-6dfc-4394-93d9-758fc1640314.lovable.app/api/public/agent-callback
IMPERIUM_CALLBACK_SECRET=<PASTE_TOKEN_B>        # MUST equal root .env IMPERIUM_CALLBACK_SECRET
```

Restart the local agent process after saving.

### 3. Token generation

Run twice locally to generate `<TOKEN_A>` and `<TOKEN_B>`:

```
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Validation

1. `curl http://127.0.0.1:8000/health` → 200 (already confirmed).
2. Open the Autopilot page in preview → the "Local agent online" indicator turns green within ~5s.
3. Browser DevTools → Network → `/health` request to `127.0.0.1:8000` shows `Authorization: Bearer …` header and a 200 response (no CORS error).

### Out of scope

No TypeScript, Python, route, service, or agent file changes. Only the two `.env` files above.
