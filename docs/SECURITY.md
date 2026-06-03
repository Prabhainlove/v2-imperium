# Security Guide

This document covers the project's current security posture, the audit findings, and the deployment-layer controls you must add when self-hosting.

## Audit summary (Phase E)

| Area | Status | Notes |
|------|--------|-------|
| Hardcoded API keys / secrets | ✅ Clean | No keys, tokens, or service-role values in source. Grep verified. |
| Service-role key exposure | ✅ Clean | `SUPABASE_SERVICE_ROLE_KEY` only read from `process.env` inside `*.server.ts` modules; never bundled to client. |
| Client-side secret leakage | ✅ Clean | Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` reach the browser (both publishable). |
| Environment variable handling | ✅ Documented | See `.env.example` + `docs/ENVIRONMENT.md`. Server reads `process.env`; client reads `import.meta.env.VITE_*`. |
| Authentication flow | ✅ Strong | Supabase Auth with email/password + Google OAuth via Lovable broker. Session in `localStorage` (Supabase default). |
| Authorization | ✅ Strong | Every protected server fn uses `requireSupabaseAuth` middleware (22/25 server fns; 3 are public health/agents endpoints). |
| Supabase RLS coverage | ✅ Complete | All 8 public tables have RLS enabled; 24 policies all scope to `auth.uid()`. No anon grants on user data. |
| Input validation | ✅ Strong | 27 Zod validators across 25 server functions. All inputs validated server-side. |
| File upload security | ✅ Reasonable | Resume parsing accepts PDF/DOCX; file is parsed server-side, never executed. No storage buckets currently exposed. |
| AI endpoint security | ⚠️ See below | Auth-gated. Rate limiting is deployment-layer (see § Rate Limiting). Prompt content is user-scoped, never echoed to other users. |
| Prompt injection | ⚠️ Inherent | LLM outputs are treated as untrusted text — rendered as Markdown, never `eval`'d, never inserted as HTML. |
| XSS | ✅ Clean | No `dangerouslySetInnerHTML`. No `innerHTML=` assignments. React auto-escapes. |
| CSRF | ✅ Mitigated | TanStack server fns use `POST` with custom content-type + auth bearer header; not vulnerable to classic form-based CSRF. |
| Open redirects | ✅ Clean | No `window.location = userInput` or unvalidated redirect params. |
| Unsafe HTML rendering | ✅ Clean | Markdown rendered through `react-markdown` with default sanitization. |
| Dependency vulnerabilities | 🟡 Run `npm audit` | See Phase A (dependency audit) for the resolved baseline. |
| Sensitive logging | ✅ Fixed | New `src/lib/logger.ts` redacts `password`, `secret`, `token`, `api*key`, `authorization`, `cookie`, `service*role`. |
| LocalStorage usage | ✅ Safe | Only theme preference (`imperium-theme`) + non-secret API base URL (`imperium-api-base-url`) + Supabase session (managed by Supabase SDK). No app secrets. |
| Session handling | ✅ Standard | Supabase-managed JWT in `localStorage`. Refreshed automatically. Cleared on logout. |

## Security headers

Baseline response headers are now applied globally by `src/start.ts`:

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), interest-cohort=()` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Request-Id` | Per-request correlation id (also in logs) |

### Content-Security-Policy (deployment-layer)

CSP is intentionally **not** set in app code because the safe set of origins depends on your deployment (your Supabase project URL, your CDN, optional analytics, etc.). Configure it at the edge.

Recommended starting policy (adjust origins for your Supabase project):

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https:;
  font-src 'self' data:;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://openrouter.ai https://api.openai.com https://api.anthropic.com https://ai.gateway.lovable.dev;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
```

Apply this in Cloudflare Transform Rules, nginx `add_header`, Traefik middleware, or your CDN config.

## Rate limiting (deployment-layer responsibility)

Rate limiting is **not** implemented in application code. An in-process limiter in a stateless Worker / serverless deployment would:

- Give a false sense of protection (counters reset on every cold start).
- Fail across multiple instances (each instance has its own counters).
- Break under horizontal scaling on Railway / Render / Docker Swarm / k8s.
- Be trivially bypassed by anyone hitting a different replica.

Implement rate limiting at the edge instead. Pick **one** of:

### Cloudflare Rate Limiting (easiest if you use Cloudflare)
Dashboard → Security → WAF → Rate limiting rules. Recommended:
- `/api/*` and AI-invoking server-fn paths: 30 requests / minute / IP
- Auth endpoints (`/auth`, password reset): 10 / minute / IP

### nginx (`limit_req_zone`)
```nginx
limit_req_zone $binary_remote_addr zone=ai:10m rate=30r/m;
location /_serverFn/ {
    limit_req zone=ai burst=10 nodelay;
    proxy_pass http://app;
}
```

### Traefik (middleware)
```yaml
http:
  middlewares:
    ai-ratelimit:
      rateLimit:
        average: 30
        period: 1m
        burst: 10
  routers:
    app:
      rule: "Host(`app.example.com`)"
      middlewares: [ai-ratelimit]
      service: app
```

### Upstash Redis (works inside the app, distributed)
If you need app-level enforcement (per-user, not per-IP), add an Upstash Redis instance and use `@upstash/ratelimit` in a server-fn middleware. This is the only correct in-app approach and only because the counters live in Redis, not in process memory. Not currently wired — add when you actually need per-user quotas.

### API Gateway (Kong / AWS API Gateway / Azure APIM)
Configure per-route quotas in the gateway. Use this if you already front the app with a gateway.

## What still needs the operator

| Concern | Where to configure |
|---------|---------------------|
| CSP | Edge / reverse proxy (see above) |
| Rate limiting | Edge / Redis (see above) |
| WAF rules | Cloudflare / AWS WAF / Azure Front Door |
| Bot mitigation | Cloudflare Bot Management / Turnstile |
| DDoS protection | Provider-level (Cloudflare, Fastly, etc.) |
| Secret rotation | Your secret manager (1Password, Vault, Doppler) — then update env vars |
| TLS termination | Reverse proxy / managed platform |
| Backup & PITR | Supabase Pro tier or self-hosted Postgres backup tooling |

## Secret management

- **Never commit** `.env`. It's listed in `.gitignore`.
- Required runtime secrets (server-side only):
  - `SUPABASE_URL`
  - `SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` ← service role, BYPASSES RLS — keep this server-only.
  - At least one of: `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `LOVABLE_API_KEY`
- Public (safe to bundle):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `VITE_SUPABASE_PROJECT_ID`

If a service-role key is ever leaked: rotate immediately via Supabase dashboard → Project Settings → API → "Reset service role key".

## Reporting

Found a vulnerability? Email the project maintainer privately rather than opening a public issue.
