# Database Setup & Portability

The entire backend schema lives in version control under `supabase/migrations/`. A fresh database can be recreated from these files alone — no Lovable Cloud, no dashboard clicks, no manual SQL.

## What's in version control

| File | Contents |
|------|----------|
| `20260603055328_*.sql` | Initial demo tables (`candidate_profiles`, `job_listings`, `applications`, `activity_log`) |
| `20260603064503_*.sql` | Schema refinements |
| `20260603065934_*.sql` | `profiles` table, `handle_new_user()` trigger, per-user RLS migration |
| `20260603070627_*.sql` | Indexes & policy tweaks |
| `20260603083701_*.sql` | `resume_documents` & `resume_versions` |
| `20260603100130_*.sql` | `brain_memory` (Brain cache/state) |

Every migration includes:
- `CREATE TABLE` + `GRANT` for `authenticated` / `service_role`
- `ENABLE ROW LEVEL SECURITY`
- `CREATE POLICY` (all per-user, scoped to `auth.uid()`)
- Required functions & triggers (`set_updated_at`, `handle_new_user`)

## Recreating the database from scratch

### Option A — Hosted Supabase (recommended)

1. Create a new project at https://supabase.com
2. Install the Supabase CLI: `npm install -g supabase`
3. Link & push:
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
4. Copy the new project's URL + keys into `.env` (see `.env.example`).

### Option B — Self-hosted Supabase (Docker)

1. Follow https://supabase.com/docs/guides/self-hosting/docker
2. From this repo:
   ```bash
   supabase db push --db-url postgresql://postgres:<pw>@localhost:54322/postgres
   ```
3. Point `.env` at your self-hosted URL + keys.

### Option C — Plain Postgres (no Supabase Auth)

The schema runs on vanilla Postgres 15+, but RLS policies reference `auth.uid()` (a Supabase Auth function). If you replace Supabase Auth, you must:
1. Provide a compatible `auth.uid()` function returning the current user's UUID.
2. Apply migrations in order: `for f in supabase/migrations/*.sql; do psql "$DATABASE_URL" -f "$f"; done`

## Verifying a fresh recreation

After applying migrations, confirm:

```sql
-- 8 tables
SELECT count(*) FROM information_schema.tables WHERE table_schema='public';

-- 24 RLS policies
SELECT count(*) FROM pg_policies WHERE schemaname='public';

-- 2 functions
SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public';
```

Expected: 8 tables, 24 policies, `set_updated_at` + `handle_new_user`.

## Tables overview

| Table | Purpose | Access |
|-------|---------|--------|
| `profiles` | User profile (linked to `auth.users` via trigger) | Owner only |
| `job_listings` | Discovered job postings | Owner only |
| `applications` | Job applications (resume + cover letter) | Owner only |
| `activity_log` | Brain/agent activity audit trail | Owner insert + read |
| `resume_documents` | Active resume (one per user) | Owner only |
| `resume_versions` | Historical resume snapshots | Owner only |
| `brain_memory` | AI Brain cache (model responses, embeddings) | Owner only |
| `candidate_profiles` | Legacy demo table (kept for back-compat) | Public (demo) |

## Storage buckets

None currently configured. If you add file storage, create buckets via SQL migration:

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
```

Then add storage RLS policies in the same migration file (see `docs/ARCHITECTURE.md`).

## Adding new migrations

Locally (with Supabase CLI):
```bash
supabase migration new <name>
# edit the generated file
supabase db push
```

Or manually: create `supabase/migrations/<timestamp>_<name>.sql` and apply with `psql`.

**Rules:**
- Every new `public` table needs `GRANT` + `ENABLE RLS` + at least one `CREATE POLICY` in the same migration.
- Never `ALTER` the `auth`, `storage`, or `realtime` schemas.
- Use validation triggers, not `CHECK` constraints, for time-based rules.
