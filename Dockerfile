# syntax=docker/dockerfile:1.7

# -----------------------------------------------------------------------------
# Imperium — production Dockerfile (Node server)
#
# Builds the TanStack Start app with the Nitro `node-server` preset and serves
# it from a slim Node 20 runtime. Works on Railway, Render, Fly, any VPS, and
# `docker compose up`.
#
# Build:   docker build -t imperium .
# Run:     docker run --env-file .env -p 3000:3000 imperium
# -----------------------------------------------------------------------------

# ---------- 1. Dependency layer ----------------------------------------------
FROM node:20-bookworm-slim AS deps
WORKDIR /app
ENV CI=1
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --no-audit --no-fund

# ---------- 2. Build layer ----------------------------------------------------
FROM node:20-bookworm-slim AS build
WORKDIR /app
ENV NODE_ENV=production \
    NITRO_PRESET=node-server
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------- 3. Runtime layer --------------------------------------------------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0
RUN useradd --system --uid 1001 --create-home imperium
COPY --from=build --chown=imperium:imperium /app/.output ./.output
COPY --from=build --chown=imperium:imperium /app/package.json ./package.json
USER imperium
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
