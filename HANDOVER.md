# Handover Guide

This repository is a **production-ready, vendor-independent** Imperium platform. It runs identically in VS Code, Docker, Railway, Render, and any VPS. No Lovable infrastructure is required.

## TL;DR for a new developer

```bash
git clone <repo>
cd <repo>
cp .env.example .env       # fill in Supabase + at least one AI provider key
npm install
npm run dev                # http://localhost:3000
```

That's it. See `docs/INSTALLATION.md` for detail.

## Architecture

- **Framework**: TanStack Start v1 (React 19 + Vite 7, SSR-capable, Node-server preset).
- **Routing**: File-based under `src/routes/`. Protected routes live under `src/routes/_authenticated/`.
- **Backend**: TanStack server functions (`createServerFn`) for app logic; server routes under `src/routes/api/public/*` for webhooks. **No Supabase Edge Functions.**
- **Database & auth**: Supabase (hosted or self-hosted). All access goes through three clients — browser, auth-middleware, admin — see `docs/ARCHITECTURE.md`.
- **AI Brain**: `src/lib/imperium/brain/*` — multi-provider router (OpenRouter → OpenAI → Anthropic → Lovable AI) with automatic failover. See `docs/BRAIN_SYSTEM.md`.
- **Styling**: Tailwind v4 + design tokens in `src/styles.css`. Dark theme by default.

```
src/
├── routes/                 # File-based routes (TanStack)
│   ├── __root.tsx          # Root shell, error boundary, 404
│   ├── _authenticated/     # Auth-gated routes (ssr: false)
│   ├── auth.tsx            # Login / signup
│   └── index.tsx           # Landing page
├── lib/
│   ├── api-response.ts     # ApiResponse envelope + AppError + envelope()
│   ├── logger.ts           # Structured logger with auto-redaction
│   ├── imperium/
│   │   ├── server.functions.ts   # 25 server fns (CRUD, AI orchestration)
│   │   ├── brain/                # Multi-provider AI Brain
│   │   ├── profile/              # Resume/LinkedIn import
│   │   └── client.ts             # React-side helpers
│   └── error-page.ts       # SSR-time 500 page
├── components/
│   ├── ui/                 # shadcn primitives
│   └── imperium/           # App-specific components
├── integrations/supabase/  # Auto-generated; DO NOT EDIT
└── start.ts                # Global middleware (logging, security headers)
```

## Environment variables

Full table in `docs/ENVIRONMENT.md`. Quick reference:

| Variable | Required | Scope | Purpose |
|---|---|---|---|
| `SUPABASE_URL` | yes | server | DB + auth |
| `SUPABASE_PUBLISHABLE_KEY` | yes | server | DB + auth (anon-equivalent) |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | server | Admin operations (BYPASSES RLS) |
| `VITE_SUPABASE_URL` | yes | client | Browser Supabase client |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | yes | client | Browser Supabase client |
| `OPENROUTER_API_KEY` | one of | server | Preferred AI provider |
| `OPENAI_API_KEY` | one of | server | Fallback AI provider |
| `ANTHROPIC_API_KEY` | one of | server | Fallback AI provider |
| `LOVABLE_API_KEY` | optional | server | Lovable AI Gateway (only on Lovable) |

At least **one** AI provider key is required.

## Deployment

Choose one (full instructions in `docs/DEPLOYMENT.md`):

- **Docker**: `docker compose up --build`
- **Railway**: connect repo → set env vars → deploy
- **Render**: connect repo → web service → set env vars
- **VPS**: `npm run build && NODE_ENV=production node .output/server/index.mjs`
- **Cloudflare Workers**: build with `NITRO_PRESET=cloudflare`

## Database

The full schema lives in `supabase/migrations/`. Six migrations recreate the entire backend from scratch. See `docs/DATABASE.md` for fresh-database setup against any Supabase project (hosted, self-hosted Docker, or plain Postgres).

8 tables, 24 RLS policies, 2 functions, 4 triggers. All policies scope to `auth.uid()`.

## Security summary

- Baseline security headers applied globally (`src/start.ts`).
- All server functions authenticated via `requireSupabaseAuth` middleware (except 3 public health endpoints).
- All inputs validated with Zod.
- All errors returned through `{ success, data?, error?, meta? }` envelope — no stack traces leak to clients.
- Structured logger auto-redacts `password|secret|token|api*key|authorization|cookie|service*role`.
- **Rate limiting is deployment-layer** — see `docs/SECURITY.md` for Cloudflare / nginx / Traefik / Upstash configs.

Full audit table in `docs/SECURITY.md` and `FINAL_AUDIT.md`.

## Logging

Use `import { logger } from "@/lib/logger"`:

```ts
logger.info("user.action", { requestId, userId, action: "export_resume" });
logger.error("ai.provider_failed", { requestId, provider: "openrouter", status: 429 });
```

Every server response carries an `X-Request-Id` header. Search logs by that id to trace a single request end-to-end.

## API envelope

All NEW server functions should return through `envelope()`:

```ts
import { envelope, AppError } from "@/lib/api-response";

export const myFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => mySchema.parse(d))
  .handler(envelope("myFn", async ({ data, context, requestId }) => {
    const row = await context.supabase.from("x").select().single();
    if (row.error) throw new AppError("DATABASE_ERROR", "Could not load record.", { cause: row.error });
    return row.data;
  }));
```

Client side:

```ts
import { unwrap } from "@/lib/api-response";
const data = unwrap(await myFn({ data: { ... } }));
```

Existing server fns continue to work — they return raw data directly. New code MUST use the envelope. See `FINAL_AUDIT.md` for migration plan if you want to convert legacy fns.

## AI provider architecture

`src/lib/imperium/brain/model-router.server.ts` — provider priority is OpenRouter → OpenAI → Anthropic → Lovable AI. On rate-limit or 5xx, the router fails over to the next provider and marks the failing model unhealthy for 60s. See `docs/BRAIN_SYSTEM.md`.

## Known limitations

- **No in-app rate limiting** — by design; implement at edge (Cloudflare/nginx/Traefik). See `docs/SECURITY.md`.
- **No file storage configured** — Supabase Storage buckets are not created. Add via migration if needed.
- **Resume PDF parsing** uses `pdfjs-dist` on the client first, falls back to server-side OCR if available.
- **SSR off for `_authenticated/*`** — by design (Supabase session lives in `localStorage`). Public routes still SSR normally for SEO.

## Production readiness checklist

See `FINAL_AUDIT.md` — every item green except the deployment-layer items (CSP, rate limiting, WAF) which are operator responsibility.

## Future improvements (optional)

- Convert remaining 25 server fns to the `envelope()` pattern for fully uniform responses.
- Add Upstash Redis + `@upstash/ratelimit` middleware for per-user quotas.
- Add Sentry (or equivalent) by piping `logger.error` to its SDK.
- Add Storybook for the 30+ UI components in `src/components/ui/`.
- Add E2E tests with Playwright.

## Where to ask questions

Read in this order: `README.md` → `docs/INSTALLATION.md` → `docs/ARCHITECTURE.md` → `docs/DATABASE.md` → `docs/BRAIN_SYSTEM.md` → `docs/SECURITY.md` → `docs/DEPLOYMENT.md`. Each file is self-contained.
