# Changelog

All notable production-readiness changes. Dates are ISO; versions are semantic milestones, not npm releases.

## [1.0.0] — 2026-06-03 — Production-ready handover

This release delivers the repository as a fully independent, deployable platform with no Lovable infrastructure dependency.

### Phase C — Database portability
- Added `docs/DATABASE.md` with fresh-DB recreation instructions for hosted Supabase, self-hosted Docker, and plain Postgres.
- Verified all 6 migrations in `supabase/migrations/` recreate the live schema exactly (8 tables, 24 RLS policies, 2 functions, 4 triggers).

### Phase E — Security audit & hardening
- **Added** `src/lib/logger.ts` — structured logger with auto-redaction of sensitive keys (`password|secret|token|api*key|authorization|cookie|service*role`).
- **Updated** `src/start.ts` — global request middleware now:
  - Generates per-request `X-Request-Id` correlation id.
  - Emits structured `request.complete` / `request.failed` logs.
  - Applies 5 baseline security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`.
- **Added** `docs/SECURITY.md` — full audit table + CSP template + rate-limiting playbook for Cloudflare, nginx, Traefik, Upstash Redis, and API Gateway.
- **Confirmed clean**: no hardcoded secrets, no service-role leakage, no `dangerouslySetInnerHTML` with user data, no open redirects.

### Phase B — Global error handling & structured logging
- **Added** `src/lib/api-response.ts`:
  - `ApiResponse<T>` envelope: `{ success, data?, error?, meta? }`.
  - `AppError` typed error class with `code`, `httpStatus`, `safeMessage`.
  - `envelope()` higher-order handler wrapper — auto-catches `ZodError`, `AppError`, unknown errors; logs full detail server-side; returns user-safe message client-side.
  - `unwrap()` helper for the client.
  - `ApiErrorCode` union covers AI, database, upload, export, auth, validation, internal errors.
- Existing global React error boundary in `src/routes/__root.tsx` retained (already correct shape).
- Server-side error handler in `src/start.ts` upgraded to structured logging with request-id propagation.
- Confirmed only 2 `console.*` calls remain — both in client UI code, intentional.

### Phase A — Dependency audit
- Audited all 60 dependencies + 14 dev-dependencies.
- **No removals required.** Every package is in active use:
  - Radix UI primitives → 30 shadcn components.
  - `mammoth` + `pdfjs-dist` → resume import.
  - `motion` → onboarding & dashboard animations.
  - `recharts` → activity charts.
  - `@codemirror/*` + `@uiw/react-codemirror` → resume markdown editor.
  - `react-hook-form` + `@hookform/resolvers` + `zod` → forms & validation.
- **Recommended action for operator**: run `npm audit --omit=dev` after `npm install` and `npm update` minor versions monthly.
- See `FINAL_AUDIT.md` § Dependencies for the full table.

### Phase D — API standardization
- Documented the canonical envelope shape for all NEW server functions and server routes.
- `src/lib/api-response.ts` is the single source of truth.
- Legacy server functions retained as-is (returning raw data) to avoid breaking client call sites. Migration path documented in `HANDOVER.md` § API envelope.

### Phase 1 (earlier) — Portability essentials
- Added multi-provider AI Brain (OpenRouter / OpenAI / Anthropic / Lovable) with automatic failover.
- Added `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `.env.example`.
- Added `docs/INSTALLATION.md`, `docs/ENVIRONMENT.md`, `docs/DEPLOYMENT.md`, `docs/ARCHITECTURE.md`, `docs/BRAIN_SYSTEM.md`.

### Handover deliverables
- **Added** `HANDOVER.md` — single-document onboarding for a new developer.
- **Added** `FINAL_AUDIT.md` — production-readiness checklist with verification results.
- **Added** `CHANGELOG.md` — this file.

## [0.x] — Prior development

Iterative feature work building the Imperium AI job-agent platform on Lovable. Not chronicled here; see git history.
