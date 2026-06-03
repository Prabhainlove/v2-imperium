# Deployment

Imperium ships as a standard Node app. The same build runs on Docker,
Railway, Render, Fly.io, or any VPS. There is no platform lock-in.

---

## 1. Build target

TanStack Start uses Nitro under the hood, so the deployment "preset"
controls the output shape:

| Preset             | Output                                  | Use for                              |
| ------------------ | --------------------------------------- | ------------------------------------ |
| `node-server`      | `.output/server/index.mjs` (Node)       | VPS, Railway, Render, Fly, Docker    |
| `cloudflare-module`| Cloudflare Worker bundle                | Cloudflare Workers / Pages           |
| `vercel`           | Vercel functions                        | Vercel                               |

Choose the preset at build time:

```bash
NITRO_PRESET=node-server npm run build
```

---

## 2. Docker (recommended for self-host)

A production-grade `Dockerfile` and `docker-compose.yml` ship in the repo.

```bash
cp .env.example .env       # fill in Supabase + AI keys
docker compose up --build  # builds & runs on http://localhost:3000
```

The image:

- Multi-stage build (slim `node:20-bookworm-slim` runtime, no build toolchain in final layer).
- Runs as non-root user `imperium`.
- Built-in healthcheck on `GET /`.

To push to a registry:

```bash
docker build -t ghcr.io/<you>/imperium:latest .
docker push ghcr.io/<you>/imperium:latest
```

---

## 3. Railway

1. Create a new Railway project from your GitHub repo.
2. Railway auto-detects the `Dockerfile`. No `nixpacks.toml` needed.
3. **Variables** tab → paste contents of your `.env`. Make sure to set
   `PORT=3000` (Railway exports its own `$PORT` — the Dockerfile already
   defaults to it).
4. Deploy. The healthcheck on `/` will go green within ~30s.

---

## 4. Render

1. New → **Web Service** → connect repo.
2. Environment: **Docker**.
3. Plan: any (Starter is fine for testing).
4. Add environment variables from your `.env`.
5. Health check path: `/`.
6. Create Web Service.

---

## 5. VPS (Ubuntu / Debian / etc.)

```bash
# On the server
git clone <your-repo-url> /opt/imperium
cd /opt/imperium
cp .env.example .env  # edit with production values
docker compose up -d --build
```

Put a reverse proxy (Caddy, nginx, Traefik) in front for TLS:

```caddy
# /etc/caddy/Caddyfile
imperium.example.com {
    reverse_proxy localhost:3000
}
```

---

## 6. Plain Node (no Docker)

```bash
NITRO_PRESET=node-server npm ci
NITRO_PRESET=node-server npm run build
PORT=3000 HOST=0.0.0.0 node .output/server/index.mjs
```

Run under `pm2`, `systemd`, or any process manager of your choice.

Example `systemd` unit:

```ini
# /etc/systemd/system/imperium.service
[Unit]
Description=Imperium
After=network.target

[Service]
Type=simple
User=imperium
WorkingDirectory=/opt/imperium
EnvironmentFile=/opt/imperium/.env
ExecStart=/usr/bin/node .output/server/index.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

---

## 7. Post-deploy checklist

- [ ] `https://YOUR-DOMAIN/` loads the landing page.
- [ ] Sign-up + sign-in work.
- [ ] **Supabase → Authentication → URL Configuration**: add your
      production URL to *Site URL* and *Redirect URLs*.
- [ ] AI-powered features (resume scoring, job analysis) succeed.
- [ ] Healthcheck endpoint returns 200.
- [ ] Outbound `OPENROUTER_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`
      requests succeed from the deployment region (no egress firewall).

---

## 8. Rolling back

Tag every release image (`imperium:2026-06-03`, `imperium:2026-06-04`, …)
and roll back by pointing your platform back at the previous tag. The
database schema is forward-compatible; no special migration rollback is
required for minor releases.
