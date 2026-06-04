# Running Imperium 100% Locally

Imperium is portable — it does not require Lovable runtime services. You can
clone, open in VS Code, and run everything on your laptop.

## 1. Prerequisites

- Node 20+ (or [Bun](https://bun.sh) — `npm` works fine)
- Python 3.10+ (for the local automation agent)
- A free [Supabase](https://supabase.com) project (database + auth)
- Optional: an [OpenRouter](https://openrouter.ai) API key for AI features

## 2. Frontend

```bash
git clone <your-repo>
cd <repo>
npm install
```

Create `.env` at the repo root with **your** Supabase values:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
VITE_SUPABASE_PROJECT_ID=YOUR-PROJECT
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=eyJ...service-role...   # server-side only

# Optional — for Imperium Brain (AI features). If none set, AI calls are disabled.
OPENROUTER_API_KEY=sk-or-...
# or OPENAI_API_KEY=...
# or ANTHROPIC_API_KEY=...
```

Apply the database schema by running every file in `supabase/migrations/`
against your project (use the Supabase CLI: `supabase db push`, or paste them
into the SQL editor in order).

Start the dev server:

```bash
npm run dev
```

The app is now at <http://localhost:3000>.

## 3. Local Automation Agent (Playwright)

The agent runs separately and drives a real Chromium browser on your machine.

```bash
cd IMPERIUM/local_agent
python -m pip install -r requirements.txt
python -m playwright install chromium
cp .env.example .env       # then fill in SUPABASE_URL + SERVICE_ROLE_KEY
python main.py
```

You should see `Imperium local automation agent started`.

Open <http://localhost:3000/autopilot>, paste a job URL, click **Queue**, and
watch the browser open and drive the application. It pauses for your
**Approve / Reject** before submitting.

## 4. Build

```bash
npm run build
```

## What is and isn't Lovable-dependent?

| Feature | Status |
| --- | --- |
| Authentication (email + Google OAuth) | ✅ Plain Supabase Auth |
| Database, RLS, realtime | ✅ Your own Supabase project |
| Resume builder, preview, PDF export | ✅ Local (jsPDF / RenderCV) |
| Job search | ✅ External APIs only — no jobs are cached |
| Application tracker, interviews, skill gap | ✅ Supabase tables |
| **Local browser automation (Autopilot)** | ✅ Playwright on your machine |
| Imperium Brain (AI) | ✅ Routed through OpenRouter / OpenAI / Anthropic |
| Lovable AI Gateway (`LOVABLE_API_KEY`) | ❌ Removed — no longer required |
| Lovable OAuth wrapper (`@lovable.dev/cloud-auth-js`) | ❌ Removed from sign-in flow |
| Scanned-PDF OCR fallback | ⚠ Removed (was Lovable-only). Upload text PDFs. |

The only file that still imports the Lovable OAuth helper is the
auto-generated stub at `src/integrations/lovable/index.ts`; nothing in the
app calls it. You can safely delete it once you're confident nothing else
depends on it.
