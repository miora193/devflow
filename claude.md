# DevFlow — Claude Project Memory

## What this project is
A production-level, multi-workspace SaaS PR analytics dashboard.
Developers connect GitHub repos and get real-time pull request insights,
team velocity metrics, and an AI-powered code review assistant.

Simple version: This app shows what the code means and how the team is
doing. Built for teams, not just code. A tool to understand and improve
how the team works.

## Who is building it
Danisha — Senior Software Engineer moving toward Tech Lead.
Needs every concept explained simply with comments in code.
Production-level quality throughout.

## Current status
PHASE 3 IN PROGRESS — Analytics & Charts

## Phase 1 — COMPLETE ✓
- pnpm monorepo with shared TypeScript types
- Docker stack — React (5173), Node.js API (4000), PostgreSQL (5432)
- PostgreSQL schema — User, Workspace, WorkspaceMember, RBAC roles
- GitHub OAuth login with JWT in httpOnly cookie
- React auth context, useAuth hook, ProtectedRoute
- Login page and Dashboard page
- End-to-end login flow working
- Merged to main — tagged v0.1.0

## Phase 2 — COMPLETE ✓
- Redis in Docker for BullMQ queue storage
- Prisma schema — Repository, PullRequest, Review models
- GitHub webhook endpoint with HMAC signature verification
- BullMQ queue with exponential backoff retry
- Sync worker — fetches PRs and reviews from GitHub API
- Repo connect + manual sync endpoints
- PR list API with pagination and state filtering
- React repositories page and PR list page
- Merged to main — tagged v0.2.0

## Phase 3 checklist — COMPLETE ✓
- [x] Step 1: Understand what Phase 3 builds
- [x] Step 2: Install chart dependencies (Recharts, D3, date-fns)
- [x] Step 3: Analytics API endpoints (cycle time, velocity, review stats)
- [x] Step 4: Analytics React Query hooks
- [x] Step 5: PR cycle time chart (D3 scatter plot)
- [x] Step 6: Team velocity chart (Recharts area chart)
- [x] Step 7: Review depth chart (Recharts bar chart)
- [x] Step 8: PR heatmap (D3 calendar heatmap)
- [x] Step 9: Analytics dashboard page
- [x] Step 10: Commit and merge Phase 3 to main


## Phase 4 checklist — COMPLETE ✓
- [x] Step 1: Understand what Phase 4 builds
- [x] Step 2: Install Socket.io dependencies
- [x] Step 3: Socket.io server setup with Redis pub/sub
- [x] Step 4: Emit real-time events from the sync worker
- [x] Step 5: React Socket.io client connection
- [x] Step 6: Live PR status updates in the PR list
- [x] Step 7: Real-time notification badge
- [x] Step 8: Commit and merge Phase 4 to main


## Current status
PHASE 5 - AI Review Assistant

## Phase 5 checklist
- [x] Step 1: Understand what Phase 5 builds
- [x] Step 2: Install AI dependencies (OpenAI SDK, eventsource-parser)
- [x] Step 3: AI review API endpoint with streaming SSE
- [x] Step 4: React streaming hook (useAIReview)
- [x] Step 5: AI review panel component
- [x] Step 6: Wire up to the PR list page
- [x] Step 7: Commit and merge Phase 5 to main

## Current status
PHASE 6 IN PROGRESS — Production + Deployment

## Phase 6 checklist
- [x] Step 1: Understand the deployment plan
- [x] Step 2: ESLint + Prettier
- [ ] Step 3: GitHub Actions CI
- [ ] Step 4: Prepare app for production
- [ ] Step 5: Deploy PostgreSQL on Neon
- [ ] Step 6: Deploy Redis on Upstash
- [ ] Step 7: Deploy API on Render
- [ ] Step 8: Deploy frontend on Vercel
- [ ] Step 9: Connect everything + go live

## Phase 6 checklist
- [ ] Step 1: Understand what Phase 6 builds
- [ ] Step 2: ESLint + Prettier — code quality rules
- [ ] Step 3: Vitest — unit tests for the sync worker and analytics
- [ ] Step 4: GitHub Actions CI — runs lint and tests on every PR
- [ ] Step 5: API error handling middleware — consistent error responses
- [ ] Step 6: Request logging with Morgan
- [ ] Step 7: Health check endpoint improvements
- [ ] Step 8: Commit and merge Phase 6 to main


## Tech stack
Frontend  : React 19, TypeScript, Vite 6, TanStack Query v5, Zustand, Recharts, D3
Backend   : Node.js, Express, TypeScript
Database  : PostgreSQL 16 via Prisma ORM
Queue     : BullMQ + Redis
Auth      : GitHub OAuth + JWT in httpOnly cookies
Infra     : Docker, docker-compose, pnpm monorepo

## Folder structure
devflow/
├── apps/
│   ├── web/                    React frontend — port 5173
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── context/AuthContext.tsx
│   │       ├── components/ProtectedRoute.tsx
│   │       ├── hooks/
│   │       │   ├── useRepos.ts         Phase 2
│   │       │   └── useAnalytics.ts     Phase 3 — coming
│   │       ├── lib/api.ts
│   │       └── pages/
│   │           ├── LoginPage.tsx
│   │           ├── DashboardPage.tsx
│   │           ├── RepositoriesPage.tsx
│   │           ├── PullRequestsPage.tsx
│   │           └── AnalyticsPage.tsx   Phase 3 — coming
│   └── api/                    Express backend — port 4000
│       └── src/
│           ├── index.ts
│           ├── routes/
│           │   ├── auth.ts
│           │   ├── repos.ts
│           │   ├── webhooks.ts
│           │   └── analytics.ts        Phase 3 — coming
│           ├── queues/sync.queue.ts
│           ├── workers/sync.worker.ts
│           └── lib/github.ts
├── packages/
│   └── types/src/index.ts      Shared TypeScript types
├── docker-compose.yml
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── CLAUDE.md

## Ports
React app     : http://localhost:5173
API server    : http://localhost:4000
Database      : localhost:5432
Redis         : localhost:6379
Prisma Studio : http://localhost:5555 (when running)

## How to start everything
docker compose up

## How to access the database
Option 1 — Prisma Studio (visual):
  docker compose exec api sh -c "cd /app/apps/api && npx prisma studio --port 5555 --browser none --hostname 0.0.0.0"
  then open http://localhost:5555

Option 2 — psql (terminal):
  docker compose exec db psql -U devflow -d devflow

Option 3 — TablePlus/DBeaver GUI:
  Host: localhost | Port: 5432 | DB: devflow | User: devflow | Pass: devflow_secret

## How to run migrations
docker compose exec api sh -c "cd /app/apps/api && npx prisma migrate dev --name description_here"

## Git workflow
- main         : always stable, merged at end of each phase
- phase/N-name : feature branch for each phase
- Commit after every meaningful piece of work
- Push to GitHub immediately — that is your backup

## Key decisions and why
- pnpm workspaces  : share TypeScript types between frontend and backend
- httpOnly cookies : safer than localStorage — JS cannot read them
- React Query      : handles server state, caching, background refetch
- Zustand          : handles client-only UI state (sidebar open, theme)
- Docker           : identical environment on every machine
- BullMQ + Redis   : async job queue — handles webhook bursts without crashing
- Octokit          : GitHub's official JS library — typed, reliable
- Recharts         : standard charts (area, bar) — React-native, easy to use
- D3.js            : custom charts (scatter plot, heatmap) — full control
- date-fns         : clean typed date arithmetic for grouping and aggregation

## Phases overview
Phase 1 : Foundation + Auth — COMPLETE ✓
Phase 2 : GitHub data pipeline — COMPLETE ✓
Phase 3 : Analytics + charts — COMPLETE ✓
Phase 4 : Real-time layer (Socket.io, Redis pub/sub) — COMPLETE ✓
Phase 5 : AI review assistant (streaming SSE, OpenAI) — COMPLETE ✓
Phase 6 : Production hardening (CI/CD, tests, monitoring)

## Notes for Claude
- Explain every concept in simple language / baby way before showing code
- Add comments to every line of code that is not obvious
- Wait for confirmation that each step worked before moving on
- This is production level — security, error handling, clean architecture
- One step at a time — never give multiple steps at once without confirmation
- Commit instructions included at the end of every step