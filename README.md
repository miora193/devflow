![CI](https://github.com/miora193/devflow/actions/workflows/ci.yml/badge.svg)
# DevFlow

> PR analytics and team insights for engineering teams.  
> Built by Danisha Soobhen — Senior Software Engineer → Tech Lead

---

## What is DevFlow?

DevFlow connects to GitHub and gives engineering teams visibility into their pull request workflow. Connect your repositories and DevFlow tracks every PR — who opened it, how long it has been open, who reviewed it, and how many files changed.

**Tech stack:** React 19 · Node.js · TypeScript · PostgreSQL · Redis · Docker · GitHub OAuth · BullMQ · Prisma ORM

---

## Prerequisites

Make sure these are installed before anything else:

```bash
node --version     # v20 or higher
pnpm --version     # v8 or higher
docker --version   # v24 or higher
git --version      # any recent version
```

Install pnpm if missing:
```bash
npm install -g pnpm
```

Install Docker Desktop from https://docker.com/products/docker-desktop and make sure it is **open and running** before using any docker commands.

---

## Fresh Installation

### Step 1 — Clone the repo

```bash
git clone git@github.com:miora193/devflow.git
cd devflow
git checkout phase/2-data-pipeline
```

Or switch to main if Phase 2 is merged:
```bash
git checkout main
```

---

### Step 2 — Create the environment file

```bash
cp apps/api/.env.example apps/api/.env
```

Now open `apps/api/.env` and fill in your real values:

```bash
# Server
PORT=4000

# Database — do NOT change @db:5432, that is the Docker service name
DATABASE_URL="postgresql://devflow:devflow_secret@db:5432/devflow"

# GitHub OAuth App (from https://github.com/settings/developers)
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here

# JWT — any long random string, minimum 32 characters
JWT_SECRET=replace_with_a_long_random_string_minimum_32_chars

# Where your React app runs
CLIENT_URL=http://localhost:5173

# Redis — do NOT change, matches Docker service name
REDIS_URL=redis://redis:6379

# Webhook secret — generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here

# GitHub Personal Access Token (from https://github.com/settings/tokens?type=beta)
GITHUB_TOKEN=your_github_token_here

NODE_ENV=development
```

> **Important:** The `.env` file is never committed to GitHub. It only lives on your machine.

---

### Step 3 — Install dependencies

```bash
pnpm install
```

This reads all `package.json` files across the monorepo and installs everything. Also links `@devflow/types` into both apps automatically.

---

### Step 4 — Start everything

```bash
docker compose up --build
```

Use `--build` the first time, or after changing a Dockerfile or `package.json`.  
After the first time, just use:

```bash
docker compose up
```

Wait until you see all three of these in the logs:

```
db-1    | database system is ready to accept connections
redis-1 | Ready to accept connections tcp
api-1   | DevFlow API running → http://localhost:4000
web-1   | VITE v6.x  ready in Xms → http://localhost:5173
```

---

### Step 5 — Run the database migration (first time only)

Open a **second terminal** while Docker is running:

```bash
docker compose exec api sh -c "cd /app/apps/api && npx prisma migrate dev --name init"
```

You should see:
```
Your database is now in sync with your schema.
```

This creates the tables: `User`, `Workspace`, `WorkspaceMember`, `Repository`, `PullRequest`, `Review`.

> Only run this once. If you wipe the database and start fresh, run it again.

---

### Step 6 — Verify everything works

Open these in your browser:

| URL | Expected result |
|-----|----------------|
| http://localhost:4000/health | `{"status":"ok","timestamp":"..."}` |
| http://localhost:5173 | DevFlow login page |

If both work — you are good to go.

---

### Step 7 — Log in

Click **"Continue with GitHub"** on the login page.  
Authorize the app on GitHub.  
You will be redirected to the dashboard showing your GitHub avatar and username.

---

## Daily Workflow

```bash
# Start work
docker compose up

# Stop work
docker compose down
```

Your database data is saved in a Docker volume — it survives restarts.  
Only `docker compose down -v` wipes the data (use carefully).

---

## GitHub OAuth Setup (if setting up from scratch)

1. Go to https://github.com/settings/developers
2. Click **OAuth Apps** → **New OAuth App**
3. Fill in:
   - Application name: `DevFlow Local`
   - Homepage URL: `http://localhost:5173`
   - Authorization callback URL: `http://localhost:4000/auth/github/callback`
4. Click **Register application**
5. Copy the **Client ID**
6. Click **Generate a new client secret** — copy it immediately
7. Paste both into `apps/api/.env`

---

## GitHub Token Setup (for syncing PR data)

1. Go to https://github.com/settings/tokens?type=beta
2. Click **Generate new token**
3. Name: `DevFlow Local` · Expiration: 90 days
4. Repository permissions: Pull requests → Read-only, Contents → Read-only, Metadata → Read-only
5. Generate and paste into `GITHUB_TOKEN` in `apps/api/.env`

---

## Connecting a Repository

1. Log into DevFlow
2. Go to http://localhost:5173/repos
3. Type a repo name in `owner/repo` format — e.g. `miora193/devflow`
4. Click **Connect repo**
5. DevFlow will sync all existing PRs in the background

---

## Accessing the Database

**Option 1 — Prisma Studio (visual, easiest):**
```bash
docker compose exec api sh -c "cd /app/apps/api && npx prisma studio --port 5555 --browser none --hostname 0.0.0.0"
```
Then open http://localhost:5555

**Option 2 — PostgreSQL terminal:**
```bash
docker compose exec db psql -U devflow -d devflow
```
```sql
\dt                        -- list all tables
SELECT * FROM "User";      -- see all users
\q                         -- quit
```

**Option 3 — GUI (TablePlus / DBeaver):**
```
Host:     localhost
Port:     5432
Database: devflow
Username: devflow
Password: devflow_secret
```

---

## Running a Migration (after schema changes)

```bash
docker compose exec api sh -c "cd /app/apps/api && npx prisma migrate dev --name describe_your_change"
```

---

## Useful Commands

```bash
# View API logs
docker compose logs api --tail=30

# View all logs
docker compose logs --tail=20

# Restart just the API (picks up .env changes)
docker compose up --force-recreate api

# Rebuild everything from scratch (no cache)
docker compose build --no-cache
docker compose up

# Ping Redis
docker compose exec redis redis-cli ping
# Should return: PONG

# Check environment variable is loaded
docker compose exec api sh -c "echo \$GITHUB_CLIENT_ID"

# Wipe database completely and start fresh
docker compose down -v
docker compose up
# Then re-run the migration
```

---

## Project Structure

```
devflow/
├── apps/
│   ├── api/                    Node.js + Express backend (port 4000)
│   │   ├── src/
│   │   │   ├── index.ts        Entry point — starts server + worker
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts     GitHub OAuth, /auth/me, logout
│   │   │   │   ├── repos.ts    Connect repos, sync, PR list
│   │   │   │   └── webhooks.ts Receives GitHub PR events
│   │   │   ├── queues/
│   │   │   │   └── sync.queue.ts   BullMQ queue definition
│   │   │   ├── workers/
│   │   │   │   └── sync.worker.ts  Processes sync jobs
│   │   │   └── lib/
│   │   │       └── github.ts   Octokit GitHub API client
│   │   └── prisma/
│   │       └── schema.prisma   Database table definitions
│   └── web/                    React 19 + Vite frontend (port 5173)
│       └── src/
│           ├── main.tsx        Entry point — boots React
│           ├── App.tsx         Route map
│           ├── context/
│           │   └── AuthContext.tsx   Login state (useAuth hook)
│           ├── components/
│           │   └── ProtectedRoute.tsx  Guards private pages
│           ├── hooks/
│           │   └── useRepos.ts  React Query hooks for repo/PR data
│           ├── lib/
│           │   └── api.ts      Axios instance (always sends cookie)
│           └── pages/
│               ├── LoginPage.tsx
│               ├── DashboardPage.tsx
│               ├── RepositoriesPage.tsx
│               └── PullRequestsPage.tsx
├── packages/
│   └── types/                  Shared TypeScript types (both apps import from here)
│       └── src/index.ts        User, Workspace, PullRequest, Repository...
├── docker-compose.yml          Starts all 4 services together
├── pnpm-workspace.yaml         Monorepo config
├── tsconfig.base.json          Shared TypeScript rules
└── CLAUDE.md                   Project memory for Claude sessions
```

---

## Ports

| Port | Service | URL |
|------|---------|-----|
| 5173 | React app | http://localhost:5173 |
| 4000 | Node.js API | http://localhost:4000 |
| 5432 | PostgreSQL | Use TablePlus / psql |
| 6379 | Redis | redis-cli only |
| 5555 | Prisma Studio | http://localhost:5555 (when running) |

---

## Phases

| Phase | Status | What it builds |
|-------|--------|---------------|
| Phase 1 | ✅ Complete | Monorepo, Docker, Auth, Prisma schema, React auth layer |
| Phase 2 | ✅ Complete | Webhooks, BullMQ, sync worker, repo connect, PR list |
| Phase 3 | ⏳ Pending | Analytics, charts (D3, Recharts) |
| Phase 4 | ⏳ Pending | Real-time (Socket.io, Redis pub/sub) |
| Phase 5 | ⏳ Pending | AI review assistant (streaming SSE, OpenAI) |
| Phase 6 | ⏳ Pending | Production hardening (CI/CD, tests, monitoring) |

---

## If Something Goes Wrong

**API crashes on startup:**
```bash
docker compose logs api --tail=30
```
Most common cause: `.env` file missing or incomplete.

**`ERR_EMPTY_RESPONSE` from the frontend:**
The API crashed. Check API logs as above.

**Prisma "did not initialize" error:**
Run `prisma generate` inside the container:
```bash
docker compose exec api sh -c "cd /app/apps/api && npx prisma generate"
```

**Port already in use:**
Something else is using 4000 or 5173. Stop it or change the port in `docker-compose.yml`.

**Database connection refused:**
Make sure Docker Desktop is open and the `db` container is healthy:
```bash
docker compose ps
```

**`.env` changes not taking effect:**
`docker compose restart` does NOT re-read `.env`. Use:
```bash
docker compose up --force-recreate api
```

---

## Recovery (laptop dies or fresh machine)

```bash
git clone git@github.com:miora193/devflow.git
cd devflow
cp apps/api/.env.example apps/api/.env
# Fill in .env with your real values
pnpm install
docker compose up --build
# In second terminal:
docker compose exec api sh -c "cd /app/apps/api && npx prisma migrate dev --name init"
```

That is it. Back up and running in under 10 minutes.