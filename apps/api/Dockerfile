# ─────────────────────────────────────────────────────────────────────────────
# WHAT IS THIS FILE?
# A Dockerfile is a recipe for building a container.
# Each line is one step. Docker runs them in order.
# The result is a sealed, portable box that runs our API identically
# on any machine — your laptop, a teammate's machine, or a cloud server.
# ─────────────────────────────────────────────────────────────────────────────

# FROM — which base image to start from.
# Think of it like: "start with a machine that already has Node 20 installed."
# ─────────────────────────────────────────────────────────────────────────────
# We use node:20-slim (Debian) instead of node:20-alpine for the API.
# WHY: Alpine Linux does not include OpenSSL by default.
#      Prisma needs OpenSSL to run its database engine.
#      Debian slim ships with OpenSSL 3.0 already installed.
#      Alpine would work too but requires manually installing OpenSSL first.
#      Debian slim is simpler and avoids the entire class of OpenSSL errors.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-slim

# Install required system dependencies for Prisma on Debian slim.
# openssl  → Prisma's query engine binary needs this to connect to PostgreSQL
# ca-certificates → needed for HTTPS calls (GitHub API, etc.)
RUN apt-get update -y && \
    apt-get install -y openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*


# WORKDIR — set the working directory inside the container.
# All following commands run from this folder.
# If /app does not exist, Docker creates it automatically.
WORKDIR /app

# Install pnpm inside the container.
# The container starts with Node + npm but NOT pnpm, so we install it.
# --global means install it system-wide inside the container.
RUN npm install -g pnpm

# COPY package.json first — before copying the rest of the code.
# WHY? Docker caches each layer (each instruction).
# If package.json has not changed, Docker skips the "pnpm install" step
# and uses the cached result. This makes rebuilds MUCH faster.
# If we copied all code first, any code change would invalidate the cache
# and force a full reinstall every time.
# Copy root-level config files that pnpm needs to understand the workspace
# These must come first so pnpm knows this is a monorepo
# tsconfig.base.json is needed by the API's tsconfig which extends it
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./

# Copy the shared types package — the API depends on this
COPY packages/types ./packages/types

# Copy the API package.json so pnpm can install its dependencies
COPY apps/api/package.json ./apps/api/package.json

# Install all dependencies listed in package.json.
# This runs inside the container, creating node_modules inside /app.
RUN pnpm install

# Copy the Prisma schema BEFORE generating the client
# prisma generate reads schema.prisma to know what TypeScript code to generate
COPY apps/api/prisma ./apps/api/prisma

# Generate the Prisma client — this creates the TypeScript query code
# that our app imports with: import { PrismaClient } from '@prisma/client'
# Without this step, PrismaClient throws "did not initialize yet"
RUN pnpm --filter @devflow/api exec prisma generate

# Copy the rest of the API source code
COPY apps/api ./apps/api

# Tell Docker which port this container will use.
# This is documentation — it does not actually open the port.
# The actual port mapping happens in docker-compose.yml.
EXPOSE 4000

# CMD — the command to run when the container starts.
# This starts the API in development mode with auto-restart on file changes.
# --filter @devflow/api tells pnpm: "run the dev script inside the api package"
# We stay in /app (root) so pnpm can find all binaries in node_modules/.bin
CMD ["pnpm", "--filter", "@devflow/api", "dev"]