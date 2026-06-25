# syntax=docker/dockerfile:1

# =============================================================================
# Stage 1 — build the client (Vite) and the server (tsc) from source.
# =============================================================================
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# DATABASE_URL must be present for Prisma CLI commands (migrate deploy, db seed)
# during the build stage. SQLite path is relative to server/, matching the
# runtime working directory. The actual DB file is created by the migrate step
# below and at runtime lives on a mounted volume.
ENV DATABASE_URL="file:./prisma/dev.db"

# Install build toolchain (Prisma's engine needs it on slim images).
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy workspace manifests first for better layer caching.
COPY package.json package-lock.json* .npmrc ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/

# `npm ci` with optional deps enabled so the correct esbuild/Prisma platform
# binary for Linux is installed; win32-only optionals are skipped silently.
RUN npm ci --include=optional

# Copy the rest of the source.
COPY . .

# Generate the Prisma client (the server imports it at build/runtime).
RUN npm -w server run db:generate

# Build both workspaces: shared (tsc) then server (tsc) then client (vite).
# Note: the root `build` script runs them in order.
RUN npm run build

# =============================================================================
# Stage 2 — slim runtime image with only what's needed to run.
# =============================================================================
FROM node:20-bookworm-slim AS runtime

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy the built server + shared (compiled to JS) + Prisma migrations.
# shared/dist contains the compiled @poker-club/shared package that the server
# imports at runtime — the .ts sources are NOT copied (node can't run them).
COPY --from=builder /app/package.json /app/package-lock.json* ./
COPY --from=builder /app/shared/package.json ./shared/
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/server/package.json ./server/
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/prisma ./server/prisma
# The compiled client build is served as static files by Express.
COPY --from=builder /app/client/dist ./client/dist
# node_modules — npm workspaces hoists everything into the root, so a single
# copy of the root node_modules covers server + client + shared.
COPY --from=builder /app/node_modules ./node_modules

# Default config. Override ADMIN_PASSWORD etc. via environment in docker-compose.
ENV NODE_ENV=production
ENV PORT=4000
ENV DATABASE_URL="file:./prisma/dev.db"
ENV ADMIN_PASSWORD="change-me"
ENV CORS_ORIGIN="*"
ENV ADMIN_TOKEN_TTL=43200

# Persistent data lives here: SQLite file + uploaded logos/sounds.
# Mapped to a host volume in docker-compose so data survives container rebuilds.
RUN mkdir -p /app/server/uploads
VOLUME ["/app/server/prisma", "/app/server/uploads"]

# Entrypoint runs Prisma migrate + seed on every start (idempotent), then
# launches the server. The DB is created on the mounted volume at first boot.
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 4000

# Run the production server via the entrypoint. It serves the API, Socket.IO
# and the built client on a single port, so no separate web server is strictly
# required. For HTTPS or a custom domain, put nginx/Caddy in front (see DEPLOY.md).
ENTRYPOINT ["/app/docker-entrypoint.sh"]
