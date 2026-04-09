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
PHASE 2 IN PROGRESS — GitHub Data Pipeline

## Phase 1 — COMPLETE ✓
- pnpm monorepo with shared TypeScript types
- Docker stack — React (5173), Node.js API (4000), PostgreSQL (5432)
- PostgreSQL schema — User, Workspace, WorkspaceMember, RBAC roles
- GitHub OAuth login with JWT in httpOnly cookie
- React auth context, useAuth hook, ProtectedRoute
- Login page and Dashboard page
- End-to-end login flow working
- Merged to main — tagged v0.1.0

## Phase 2 checklist
- [x] Step 1: Install new dependencies (BullMQ, Redis, Octokit)
- [x] Step 2: Add Redis to Docker
- [x] Step 3: Prisma schema update — Repository, PullRequest, Review
- [x] Step 4: GitHub App registration + webhook secret
- [x] Step 5: Webhook endpoint — receives GitHub events
- [x] Step 6: BullMQ queue setup
- [ ] Step 7: Sync worker — processes jobs from the queue
- [ ] Step 8: Manual sync trigger endpoint
- [ ] Step 9: PR list API endpoint
- [ ] Step 10: React PR list page with infinite scroll
- [ ] Step 11: Commit and merge Phase 2 to main

## Tech stack
Frontend  : React 19, TypeScript, Vite 6, Tailwind CSS, TanStack Query v5, Zustand
Backend   : Node.js, Express, TypeScript
Database  : PostgreSQL 16 via Prisma ORM
Queue     : BullMQ + Redis
Auth      : GitHub OAuth + JWT in httpOnly cookies
Infra     : Docker, docker-compose, pnpm monorepo

## Folder structure
devflow/
├── apps/
│   ├── web/                    React frontend — port 5173
│   └── api/                    Express backend — port 4000
│       ├── src/
│       │   ├── index.ts
│       │   ├── routes/
│       │   │   ├── auth.ts     Phase 1 — done
│       │   │   ├── repos.ts    Phase 2 — sync trigger + PR list
│       │   │   └── webhooks.ts Phase 2 — receives GitHub events
│       │   ├── queues/         Phase 2 — BullMQ queue definitions
│       │   ├── workers/        Phase 2 — sync worker
│       │   └── lib/            Phase 2 — GitHub API client (Octokit)
├── packages/
│   └── types/                  Shared TypeScript types
├── docker-compose.yml
└── CLAUDE.md

## Ports
React app  : http://localhost:5173
API server : http://localhost:4000
Database   : localhost:5432
Redis      : localhost:6379

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

## Phases overview
Phase 1 : Foundation + Auth — COMPLETE ✓
Phase 2 : GitHub data pipeline — IN PROGRESS
Phase 3 : Analytics + charts (D3, Recharts, custom hooks)
Phase 4 : Real-time layer (Socket.io, Redis pub/sub)
Phase 5 : AI review assistant (streaming SSE, OpenAI)
Phase 6 : Production hardening (CI/CD, tests, monitoring)

## Notes for Claude
- Explain every concept in simple language/ baby way before showing code
- Add comments to every line of code that is not obvious
- Wait for confirmation that each step worked before moving on
- This is production level - security, error handling, clean architecture
- One step at a time - never give multiple steps at once without confirmation
- Commit instructions included at the end of every step