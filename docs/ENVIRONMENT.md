# Environment Variables

Every variable used by Imperium. See `.env.example` for a copy-paste
template.

## Conventions

- Variables prefixed with `VITE_` are exposed to **browser** code at build
  time. They must not contain secrets.
- All other variables are **server-only** and read via `process.env` inside
  server functions / SSR. They never reach the browser bundle.
- Boolean and numeric values are read as strings; cast in code as needed.

---

## Supabase (required)

| Name                              | Scope   | Description                                                                 |
| --------------------------------- | ------- | --------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`               | client  | Project URL, e.g. `https://abc.supabase.co`.                                |
| `VITE_SUPABASE_PUBLISHABLE_KEY`   | client  | Anon/publishable key. Safe to expose; RLS enforces access.                  |
| `VITE_SUPABASE_PROJECT_ID`        | client  | Project ref (used for telemetry / display only).                            |
| `SUPABASE_URL`                    | server  | Same value as `VITE_SUPABASE_URL`, accessible from SSR & server functions.  |
| `SUPABASE_PUBLISHABLE_KEY`        | server  | Same value as `VITE_SUPABASE_PUBLISHABLE_KEY` for server use.               |
| `SUPABASE_SERVICE_ROLE_KEY`       | server  | **SECRET.** Service-role key. Bypasses RLS. Used by admin operations only.  |
| `SUPABASE_DB_URL`                 | server  | Optional. Direct Postgres connection string for migration scripts.          |

---

## AI providers (at least one required)

The Brain (`src/lib/imperium/brain/model-router.server.ts`) tries providers
in this exact order and fails over on error or rate-limit. If none are set,
all AI calls throw a clear error.

| Name                  | Scope  | Provider                | Where to get it                                       |
| --------------------- | ------ | ----------------------- | ----------------------------------------------------- |
| `OPENROUTER_API_KEY`  | server | OpenRouter (recommended)| <https://openrouter.ai/keys>                          |
| `OPENAI_API_KEY`      | server | OpenAI direct           | <https://platform.openai.com/api-keys>                |
| `ANTHROPIC_API_KEY`   | server | Anthropic direct        | <https://console.anthropic.com/settings/keys>         |
| `LOVABLE_API_KEY`     | server | Lovable AI Gateway      | Auto-provisioned only on Lovable Cloud; ignore otherwise. |

You can set multiple — failover order is the order above.

---

## App config (optional)

| Name             | Default                 | Description                                                                 |
| ---------------- | ----------------------- | --------------------------------------------------------------------------- |
| `PUBLIC_APP_URL` | `http://localhost:3000` | Used in OpenRouter `HTTP-Referer` header and outbound links.                |
| `PORT`           | `3000`                  | Port the production Node server listens on.                                 |
| `HOST`           | `0.0.0.0`               | Bind address for the production server.                                     |
| `NODE_ENV`       | (set by tooling)        | `development` or `production`. Usually managed by Vite/Nitro automatically. |
| `NITRO_PRESET`   | (build target)          | `node-server` for self-host, `cloudflare-module` for Workers, etc.          |

---

## Validation

The app validates required variables at startup and fails fast with a
descriptive error if any are missing — it never silently runs with broken
config. See:

- `src/integrations/supabase/client.ts` — Supabase keys
- `src/integrations/supabase/client.server.ts` — service-role key
- `src/lib/imperium/brain/model-router.server.ts` — AI provider keys
