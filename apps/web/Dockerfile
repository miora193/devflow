# Same base — Node 20 on Alpine Linux
FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm

# Copy root-level monorepo config files
# tsconfig.base.json is needed because apps/web/tsconfig.json extends it
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./

# Copy the shared types package
COPY packages/types ./packages/types

# Copy the web app package.json
COPY apps/web/package.json ./apps/web/package.json

RUN pnpm install

# Copy the rest of the web source code
COPY apps/web ./apps/web

EXPOSE 5173

# "--host" is critical — it tells Vite to accept connections from
# OUTSIDE the container (i.e. your browser on your actual machine).
# Without --host, Vite only listens inside the container
# and your browser cannot reach it.
# --filter @devflow/web tells pnpm: "run the dev script inside the web package"
CMD ["pnpm", "--filter", "@devflow/web", "dev", "--host"]