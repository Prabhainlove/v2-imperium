# Imperium

Autonomous job-application platform: profile intelligence, ATS-graded resume
studio, job discovery, cover-letter generation, and application readiness.

Built with **TanStack Start** (React 19 + Vite 7 + SSR), **Supabase**
(database / auth / storage), and a multi-provider **AI Brain** (OpenRouter,
OpenAI, Anthropic, or Lovable AI — whichever keys you configure).

The repository is fully portable: it runs identically in VS Code, on
Railway, Render, Fly, a VPS, or under `docker compose up`. There is no
Lovable runtime dependency at runtime — Lovable AI is only one of four
interchangeable providers.

---

## Quick start (local development)

```bash
git clone <your-repo-url> imperium
cd imperium
cp .env.example .env
# edit .env — at minimum: Supabase keys + one AI provider key
npm install
npm run dev
```

App is then served at <http://localhost:3000>.

For full setup (Supabase project, AI provider, database migrations), see
[`docs/INSTALLATION.md`](./docs/INSTALLATION.md).

---

## Available scripts

| Script             | What it does                                              |
| ------------------ | --------------------------------------------------------- |
| `npm run dev`      | Start Vite dev server with HMR on port 3000.              |
| `npm run build`    | Production build (Nitro preset from `$NITRO_PRESET`).     |
| `npm run preview`  | Serve the production build locally.                       |
| `npm run lint`     | ESLint over `src/`.                                       |
| `npm run format`   | Prettier over the project.                                |

To build for self-hosted Node deployment:

```bash
NITRO_PRESET=node-server npm run build
node .output/server/index.mjs
```

---

## Local automation agent (Selenium)

The web app queues job applications; a small Python agent runs on your
laptop, opens a real visible Chrome window, fills the application form, and
streams every action back to the web UI in real time. See
[`IMPERIUM/local_agent/README.md`](./IMPERIUM/local_agent/README.md).

```bash
cd IMPERIUM/local_agent
pip install -r requirements.txt
cp .env.example .env  # fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, IMPERIUM_AGENT_TOKEN
python main.py
```

---

## Tech stack

- **Frontend:** React 19, Tailwind CSS v4, shadcn/ui, TanStack Router/Query.
- **Backend:** TanStack Start server functions (`createServerFn`).
- **Database / Auth:** Supabase (Postgres + GoTrue).
- **Resume / Cover Letter PDF:** jsPDF + html2canvas — pure browser, fully local.
- **Local agent:** Python + Selenium + undetected-chromedriver.
- **AI (optional):** Ollama (local) / OpenRouter / OpenAI / Anthropic / Lovable AI.

---

## License

Proprietary. © Imperium.
