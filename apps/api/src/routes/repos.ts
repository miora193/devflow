// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS THIS FILE?
// This file handles repository management:
//
//   POST /repos/connect  → user connects a GitHub repo to their workspace
//   POST /repos/:id/sync → manually trigger a full PR sync for a repo
//   GET  /repos          → list all repos connected to a workspace
//
// When a repo is connected:
//   1. We verify the repo exists on GitHub and the user has access
//   2. We save it to our Repository table
//   3. We add a "sync-repo" job to the queue to fetch all existing PRs
// ─────────────────────────────────────────────────────────────────────────────

import { Router, Request, Response } from 'express'
import { prisma } from '../index'
import { syncQueue } from '../queues/sync.queue'
import { createGithubClient } from '../lib/github'

const router = Router()


// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE — requireAuth
// All repo routes require the user to be logged in.
// This middleware checks the JWT cookie before every route in this file.
// If not logged in, it returns 401 immediately.
// ─────────────────────────────────────────────────────────────────────────────
import jwt from 'jsonwebtoken'
import type { AuthUser } from '@devflow/types'

// We extend the Express Request type to add our user property.
// Without this TypeScript would complain that req.user does not exist.
declare global {
  namespace Express {
    interface Request {
      // After requireAuth runs, req.user contains the logged-in user
      user?: AuthUser
    }
  }
}

function requireAuth(req: Request, res: Response, next: Function) {
  // Read the auth_token cookie — set during GitHub OAuth login
  const token = req.cookies?.auth_token

  if (!token) {
    return res.status(401).json({
      error: 'NOT_AUTHENTICATED',
      message: 'You must be logged in to do this',
    })
  }

  try {
    // Verify the JWT and extract the user data from it
    const user = jwt.verify(token, process.env.JWT_SECRET!) as AuthUser

    // Attach the user to the request object
    // Now every route handler can access req.user
    req.user = user
    next()

  } catch {
    res.clearCookie('auth_token')
    return res.status(401).json({
      error: 'SESSION_EXPIRED',
      message: 'Your session has expired. Please log in again.',
    })
  }
}

// Apply requireAuth to ALL routes in this file
// Every route below this line requires authentication
router.use(requireAuth)


// ─────────────────────────────────────────────────────────────────────────────
// GET /repos
// Returns all repositories connected to the user's workspace.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  // Find the workspace this user owns
  // In Phase 3 we will support multiple workspaces — for now use the first one
  const workspace = await prisma.workspace.findFirst({
    where: { ownerId: req.user!.id },
  })

  if (!workspace) {
    return res.status(404).json({
      error: 'NO_WORKSPACE',
      message: 'No workspace found for this user',
    })
  }

  // Fetch all repos connected to this workspace
  const repos = await prisma.repository.findMany({
    where: { workspaceId: workspace.id },

    // Include a count of PRs for each repo
    // This lets the frontend show "42 pull requests" without a separate call
    include: {
      _count: {
        select: { pullRequests: true },
      },
    },

    // Most recently added repo first
    orderBy: { createdAt: 'desc' },
  })

  return res.json(repos)
})


// ─────────────────────────────────────────────────────────────────────────────
// POST /repos/connect
// Connects a GitHub repository to the user's workspace.
//
// Request body:
//   { "fullName": "owner/repo" }
//
// Example:
//   { "fullName": "miora193/devflow" }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/connect', async (req: Request, res: Response) => {
  // Get the repo name from the request body
  const { fullName } = req.body

  // Validate the input
  if (!fullName || typeof fullName !== 'string') {
    return res.status(400).json({
      error: 'MISSING_FULL_NAME',
      message: 'Please provide a repository name in the format "owner/repo"',
    })
  }

  // Validate the format — must contain exactly one slash
  // e.g. "miora193/devflow" is valid, "devflow" or "a/b/c" are not
  const parts = fullName.trim().split('/')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return res.status(400).json({
      error: 'INVALID_FORMAT',
      message: 'Repository name must be in the format "owner/repo"',
    })
  }

  const [owner, repo] = parts

  // Find the user's workspace
  const workspace = await prisma.workspace.findFirst({
    where: { ownerId: req.user!.id },
  })

  if (!workspace) {
    return res.status(404).json({
      error: 'NO_WORKSPACE',
      message: 'No workspace found',
    })
  }

  // Check if this repo is already connected
  // We check both fullName and githubId to catch all duplicate cases
  const existing = await prisma.repository.findFirst({
    where: {
      workspaceId: workspace.id,
      fullName: `${owner}/${repo}`,
    },
  })

  if (existing) {
    return res.status(409).json({
      error: 'ALREADY_CONNECTED',
      message: `${owner}/${repo} is already connected to this workspace`,
    })
  }

  // ── Verify the repo exists on GitHub ─────────────────────────────────────
  // We call the GitHub API to check:
  //   1. The repo actually exists
  //   2. Our token has access to it
  //   3. We get the repo metadata (githubId, defaultBranch, isPrivate)
  const octokit = createGithubClient(process.env.GITHUB_TOKEN || '')

  let githubRepo
  try {
    const { data } = await octokit.rest.repos.get({ owner, repo })
    githubRepo = data
  } catch (error: any) {
    // 404 means the repo does not exist or we do not have access
    if (error.status === 404) {
      return res.status(404).json({
        error: 'REPO_NOT_FOUND',
        message: `Repository ${owner}/${repo} not found or not accessible`,
      })
    }
    throw error
  }

// ── Save the repository to our database ──────────────────────────────────
  let repository
  try {
    repository = await prisma.repository.create({
      data: {
        githubId:      githubRepo.id,
        fullName:      githubRepo.full_name,
        name:          githubRepo.name,
        owner:         githubRepo.owner.login,
        isPrivate:     githubRepo.private,
        defaultBranch: githubRepo.default_branch,
        workspaceId:   workspace.id,
      },
    })
  } catch (error: any) {
    // P2002 = unique constraint violation
    // This means the repo is already connected (caught by githubId uniqueness)
    if (error.code === 'P2002') {
      return res.status(409).json({
        error:   'ALREADY_CONNECTED',
        message: `${owner}/${repo} is already connected to this workspace`,
      })
    }
    throw error
  }
  // ── Queue a full sync job ─────────────────────────────────────────────────
  // This fetches all existing PRs for this repo.
  // The job runs in the background — we do not wait for it here.
  await syncQueue.add(
    'sync-repo',
    {
      repositoryId: repository.id,
      workspaceId:  workspace.id,
      fullName:     repository.fullName,
      accessToken:  process.env.GITHUB_TOKEN || '',
    },
    {
      // Unique job ID prevents duplicate sync jobs for the same repo
      jobId: `sync-repo-${repository.id}-initial`,
    }
  )

  console.log(`Repository connected: ${repository.fullName} — sync job queued`)

  return res.status(201).json({
    message: `${repository.fullName} connected successfully. Syncing PRs in the background.`,
    repository,
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// POST /repos/:id/sync
// Manually triggers a full PR sync for a specific repository.
// Useful when you want to refresh the data without waiting for a webhook.
//
// :id is our internal repository ID (the cuid from our database)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/sync', async (req: Request, res: Response) => {
  const { id } = req.params

  // Find the workspace for this user
  const workspace = await prisma.workspace.findFirst({
    where: { ownerId: req.user!.id },
  })

  if (!workspace) {
    return res.status(404).json({ error: 'NO_WORKSPACE' })
  }

  // Find the repository — make sure it belongs to this user's workspace
  // This prevents users from triggering syncs on other people's repos
  const repository = await prisma.repository.findFirst({
    where: {
      id,
      workspaceId: workspace.id,
    },
  })

  if (!repository) {
    return res.status(404).json({
      error: 'REPO_NOT_FOUND',
      message: 'Repository not found',
    })
  }

  // Add a sync job to the queue
  await syncQueue.add(
    'sync-repo',
    {
      repositoryId: repository.id,
      workspaceId:  workspace.id,
      fullName:     repository.fullName,
      accessToken:  process.env.GITHUB_TOKEN || '',
    },
    {
      // New jobId each time — allows re-syncing even if a previous sync ran
      jobId: `sync-repo-${repository.id}-${Date.now()}`,
    }
  )

  console.log(`Manual sync triggered for ${repository.fullName}`)

  return res.json({
    message: `Sync started for ${repository.fullName}`,
    repositoryId: repository.id,
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// GET /repos/:id/pulls
// Returns all pull requests for a specific repository.
// Supports pagination and filtering by state.
//
// Query params:
//   ?page=1        → page number (default 1)
//   ?limit=20      → results per page (default 20, max 50)
//   ?state=open    → filter by state: open, closed, merged (default: all)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/pulls', async (req: Request, res: Response) => {
  const { id } = req.params

  // Parse query parameters with sensible defaults
  const page  = Math.max(1, parseInt(req.query.page  as string) || 1)
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20)
  const state = req.query.state as string | undefined

  // Find the workspace
  const workspace = await prisma.workspace.findFirst({
    where: { ownerId: req.user!.id },
  })

  if (!workspace) {
    return res.status(404).json({ error: 'NO_WORKSPACE' })
  }

  // Verify the repo belongs to this workspace
  const repository = await prisma.repository.findFirst({
    where: { id, workspaceId: workspace.id },
  })

  if (!repository) {
    return res.status(404).json({ error: 'REPO_NOT_FOUND' })
  }

  // Build the where clause
  // If state is provided, filter by it. Otherwise return all PRs.
  const where: any = { repositoryId: id }
  if (state && ['open', 'closed', 'merged'].includes(state)) {
    where.state = state
  }

  // Fetch PRs with pagination
  // We use Promise.all to run both queries at the same time (faster)
  const [pullRequests, total] = await Promise.all([
    prisma.pullRequest.findMany({
      where,
      // Skip records for previous pages
      // e.g. page 2 with limit 20 skips the first 20 records
      skip:    (page - 1) * limit,
      take:    limit,
      // Most recently updated PR first
      orderBy: { githubUpdatedAt: 'desc' },
    }),

    // Count total matching PRs for pagination info
    prisma.pullRequest.count({ where }),
  ])

  return res.json({
    pullRequests,
    pagination: {
      page,
      limit,
      total,
      // Total number of pages
      totalPages: Math.ceil(total / limit),
      // Is there a next page?
      hasMore: page * limit < total,
    },
  })
})

export default router