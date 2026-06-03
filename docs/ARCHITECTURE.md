# Architecture

High-level map of the codebase. Read this before making structural
changes.

---

## Top-level layout

```
.
├── src/                        # application source
│   ├── routes/                 # TanStack Router file-based routes
│   │   ├── __root.tsx          # root layout + providers
│   │   ├── index.tsx           # public landing page
│   │   ├── auth.tsx            # sign-in / sign-up
│   │   └── _authenticated/     # gated subtree (ssr: false)
│   │       ├── dashboard.tsx
│   │       ├── jobs.tsx
│   │       ├── resume.tsx
│   │       ├── applications.tsx
│   │       └── settings.tsx
│   ├── components/
│   │   ├── ui/                 # shadcn/ui primitives
│   │   └── imperium/           # app-specific components
│   ├── hooks/
│   ├── integrations/
│   │   ├── supabase/           # generated Supabase clients (DO NOT EDIT)
│   │   └── lovable/            # optional OAuth broker (only used on Lovable Cloud)
│   ├── lib/
│   │   ├── imperium/           # business logic
│   │   │   ├── brain/          # AI Brain modules (server-only)
│   │   │   ├── profile/        # profile parsing + completeness
│   │   │   ├── client.ts       # client wrappers around server functions
│   │   │   ├── server.functions.ts  # createServerFn definitions
│   │   │   ├── pipeline.server.ts   # job-discovery pipeline
│   │   │   ├── rendercv.server.ts   # resume rendering
│   │   │   └── types.ts
│   │   ├── api/                # generic example server functions
│   │   ├── error-page.ts
│   │   └── utils.ts
│   ├── styles.css              # Tailwind v4 + design tokens
│   ├── router.tsx              # router config
│   ├── start.ts                # createStart() + middleware
│   └── server.ts               # SSR entry (wraps server-entry with error handling)
├── supabase/
│   ├── config.toml             # project config (DO NOT change project_id)
│   └── migrations/             # SQL migrations
├── docs/                       # this directory
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── package.json
```

---

## Client / server boundary

This is a TanStack Start app. The boundary is enforced by file naming
and by which files are reachable from the client bundle.

| Pattern                          | Runs on | Notes                                                       |
| -------------------------------- | ------- | ----------------------------------------------------------- |
| `*.tsx` route or component       | both    | Treat as client code. Never import `*.server.ts` directly.  |
| `*.functions.ts`                 | both*   | Defines `createServerFn`s; handler body is server-only.     |
| `*.server.ts`                    | server  | Bundler refuses to load these from client code.             |
| `src/routes/api/**`              | server  | TanStack server routes (raw HTTP endpoints).                |

\* The handler body of a server function is stripped from the client
bundle, but the file itself is reachable. Inside handlers, load admin
clients with `await import("@/integrations/supabase/client.server")` to
avoid leaking server-only modules into the client graph.

---

## Data flow

```
                  ┌─────────────────────────────────────────────┐
                  │         Browser (React, TanStack Query)     │
                  └────────────┬────────────────────────────────┘
                               │  useServerFn / useQuery
                               ▼
                  ┌─────────────────────────────────────────────┐
                  │  Server functions  (src/lib/**/.functions)  │
                  │  · requireSupabaseAuth middleware            │
                  │  · attachSupabaseAuth (client-side bearer)   │
                  └─────┬──────────────────────────┬────────────┘
                        │                          │
                        ▼                          ▼
              ┌──────────────────┐       ┌────────────────────────┐
              │   Supabase       │       │   AI Brain             │
              │  (Postgres+Auth) │       │  model-router.server   │
              │                  │       │  → OpenRouter / OpenAI │
              │                  │       │  → Anthropic / Lovable │
              └──────────────────┘       └────────────────────────┘
```

---

## The Brain (`src/lib/imperium/brain/`)

The Brain is the centralized AI layer. UI components never talk to a
model directly; they call a server function which delegates to a Brain
module.

| Module                          | Responsibility                                           |
| ------------------------------- | -------------------------------------------------------- |
| `model-router.server.ts`        | Provider failover (OpenRouter → OpenAI → Anthropic → Lovable). |
| `brain.server.ts`               | Public Brain API + result caching in `brain_memory`.     |
| `profile-analysis.server.ts`    | Career strengths, gaps, ATS score for the profile.       |
| `profile-import.server.ts`      | PDF / DOCX / LinkedIn → structured profile.              |
| `job-analysis.server.ts`        | Score a job vs. the candidate.                           |
| `resume-optimizer.server.ts`    | ATS-graded resume rewrites.                              |
| `cover-letter-generator.server.ts` | Per-job cover letters.                                |
| `application-readiness.server.ts`  | Final go/no-go for an application.                    |
| `career-intelligence.server.ts` | Market insights & growth recommendations.                |
| `github-intel.server.ts`        | Pulls GitHub signal into the profile.                    |
| `reasoning.server.ts`           | Shared structured-output helpers.                        |
| `memory.server.ts`              | Read/write the `brain_memory` cache table.               |

See [`BRAIN_SYSTEM.md`](./BRAIN_SYSTEM.md) for details.

---

## Conventions

- **Never store user roles on the `profiles` table.** Use a separate
  `user_roles` table + `has_role()` SECURITY DEFINER function. (Imperium
  doesn't expose admin roles in the UI yet; reserve this pattern when you
  add them.)
- **RLS everywhere.** Every public-schema table that holds user data has
  `auth.uid()`-scoped policies. The `service_role` (used by
  `supabaseAdmin`) bypasses RLS; only use it in server-side code paths
  that are themselves authorized.
- **No business logic in components.** UI calls server functions; server
  functions call Brain modules and Supabase.
- **No direct AI calls from components.** Always go through a Brain
  server function so failover, caching, and logging are consistent.
- **One server function per intent.** Don't add giant catch-all
  endpoints; create focused functions and let the client compose them.
