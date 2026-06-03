# Installation

How to get Imperium running locally on a fresh machine, with no Lovable
dependency.

Tested on macOS, Linux, and Windows (WSL2 recommended on Windows).

---

## 1. Prerequisites

- **Node.js 20.x or newer** — <https://nodejs.org>
- **npm 10+** (ships with Node 20)
- **git**
- A **Supabase** project — hosted at <https://supabase.com> (free tier is
  fine) or self-hosted via <https://supabase.com/docs/guides/self-hosting>.
- An **AI provider API key** — at least one of:
  - OpenRouter (<https://openrouter.ai/keys>) — recommended, one key gives
    you access to OpenAI, Anthropic, Google, Meta and more.
  - OpenAI (<https://platform.openai.com/api-keys>)
  - Anthropic (<https://console.anthropic.com/settings/keys>)

---

## 2. Clone & install

```bash
git clone <your-repo-url> imperium
cd imperium
npm install
```

`npm install` is fully offline-friendly after the first run; no Lovable
infrastructure is contacted.

---

## 3. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in:

### Supabase (required)

From **Supabase Dashboard → Project Settings → API**, copy:

| .env key                          | Where to find it                         |
| --------------------------------- | ---------------------------------------- |
| `VITE_SUPABASE_URL`               | "Project URL"                            |
| `VITE_SUPABASE_PUBLISHABLE_KEY`   | "anon / public" key                      |
| `VITE_SUPABASE_PROJECT_ID`        | the slug in your project URL             |
| `SUPABASE_URL`                    | same as VITE_SUPABASE_URL                |
| `SUPABASE_PUBLISHABLE_KEY`        | same as VITE_SUPABASE_PUBLISHABLE_KEY    |
| `SUPABASE_SERVICE_ROLE_KEY`       | "service_role" key (KEEP SECRET)         |

The duplicated `VITE_*` / non-prefixed pairs are deliberate: Vite only
exposes `VITE_*` variables to browser code, while SSR / server functions
read the unprefixed versions through `process.env`.

### AI provider (required — at least one)

Set whichever you have. The Brain automatically uses them in this priority:
OpenRouter → OpenAI → Anthropic → Lovable AI.

```env
OPENROUTER_API_KEY="sk-or-..."
# OR
OPENAI_API_KEY="sk-..."
# OR
ANTHROPIC_API_KEY="sk-ant-..."
```

If none are set, every AI request fails with a clear error message
naming the missing variable.

---

## 4. Set up the database

The Supabase project needs the Imperium tables (`profiles`,
`resume_documents`, `job_listings`, `applications`, `brain_memory`,
`activity_log`, `candidate_profiles`, `resume_versions`).

The schema and RLS policies live under `supabase/migrations/`. Apply them
with the Supabase CLI:

```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

(Or, on a self-hosted Supabase install, run the SQL files in
`supabase/migrations/` against your Postgres database in alphabetical
order.)

---

## 5. Run

```bash
npm run dev
```

Open <http://localhost:3000>. Sign up with email/password and you're in.

---

## 6. Production build (local sanity check)

```bash
npm run build
npm run preview
```

For a real production deployment, see
[`DEPLOYMENT.md`](./DEPLOYMENT.md).

---

## Troubleshooting

| Symptom                                                       | Fix                                                                                          |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `Missing Supabase environment variable(s)`                    | `.env` is missing or `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` are blank.        |
| `Brain has no AI provider configured`                         | Set at least one of `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`.             |
| `relation "public.profiles" does not exist`                   | Database migrations have not been applied. Re-run step 4.                                    |
| Auth works locally but fails in production                    | Add your production URL to **Supabase → Authentication → URL Configuration → Site URL**.    |
| Port 3000 is taken                                            | `PORT=4000 npm run dev` — Vite respects the env var.                                         |
