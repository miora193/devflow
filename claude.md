# DevFlow — Claude Project Memory

## What this project is
A production-level, multi-workspace SaaS PR analytics dashboard.
Developers connect GitHub repos and get real-time pull request insights,
team velocity metrics, and an AI-powered code review assistant.

Simple version: This app shows what the code means and how the team is doing. Built for teams, not just code. It is a tool to understand and improve how the team works.

## Who is building it
Danisha - Senior Software Engineer moving toward Tech Lead.
Rebuilding React expertise from scratch. Needs every concept explained
simply with comments in code. Production-level quality throughout.

## Current status
PHASE 1 IN PROGRESS — Foundation & Authentication

## Phase 1 checklist
- [x] Step 1: Prerequisites verified
- [x] Step 2: GitHub repo created + Git initialised  
- [x] Step 3: Monorepo folder scaffold
- [x] Step 4: Root config files (pnpm workspace, tsconfig, gitignore)
- [x] Step 5: Shared types package
- [x] Step 6: API app scaffold
- [x] Step 7: React web app scaffold
- [x] Step 8: Docker setup — all 3 containers running
- [x] Step 9: Prisma schema + first migration
- [x] Step 10: GitHub OAuth backend
- [x] Step 11: React auth layer (context, hooks, protected routes)
- [x] Step 12: End-to-end login test
- [x] Step 13: Commit and merge Phase 1 to main

## Tech stack
Frontend  : React 19, TypeScript, Vite 6, Tailwind CSS, TanStack Query v5, Zustand
Backend   : Node.js, Express, TypeScript
Database  : PostgreSQL 16 via Prisma ORM
Auth      : GitHub OAuth + JWT in httpOnly cookies
Infra     : Docker, docker-compose, pnpm monorepo

## Folder structure (when complete)
devflow/
├── apps/
│   ├── web/               React frontend — port 5173
│   └── api/               Express backend — port 4000
├── packages/
│   └── types/             Shared TypeScript types
├── docker-compose.yml
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .gitignore
└── CLAUDE.md

## Ports
React app  : http://localhost:5173
API server : http://localhost:4000
Database   : localhost:5432

## How to start everything
docker compose up

## Key decisions and why
- pnpm workspaces : share TypeScript types between frontend and backend
- httpOnly cookies : safer than localStorage — JS cannot read them
- React Query      : handles server state, caching, background refetch
- Zustand          : handles client-only UI state (sidebar open, theme)
- Docker           : identical environment on every machine

## Phases overview
Phase 1  : Foundation + Auth (current)
Phase 2  : GitHub data pipeline (webhooks, sync worker, BullMQ)
Phase 3  : Analytics + charts (D3, Recharts, custom hooks)
Phase 4  : Real-time layer (Socket.io, Redis pub/sub)
Phase 5  : AI review assistant (streaming SSE, OpenAI)
Phase 6  : Production hardening (CI/CD, tests, monitoring)

## Notes for Claude
- Explain every concept in simple language before showing code
- Add comments to every line of code that is not obvious
- Wait for confirmation that each step worked before moving on
- This is production level — security, error handling, and clean
  architecture matter throughout