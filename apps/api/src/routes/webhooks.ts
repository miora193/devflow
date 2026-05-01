// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS THIS FILE?
// This file handles incoming webhook events from GitHub.
//
// When someone opens a PR, GitHub sends a POST request to:
//   POST /webhooks/github
//
// This route:
//   1. Verifies the request is genuinely from GitHub (signature check)
//   2. Reads what event happened (PR opened, PR merged, review submitted...)
//   3. Finds which repository in our DB this event is about
//   4. Adds a job to the BullMQ queue so the worker can process it
//
// This route is intentionally fast — it just receives and queues.
// All the heavy work (calling GitHub API, updating the DB) happens in the worker.
// ─────────────────────────────────────────────────────────────────────────────

import express, { Router, Request, Response } from 'express'

// Use Node's built-in crypto module instead of @octokit/webhooks
// This avoids an ESM/CommonJS conflict with the octokit package.
// crypto is built into Node — no installation needed.
import crypto from 'crypto'

import { prisma } from '../index'
import { syncQueue } from '../queues/sync.queue'

const router: express.Router = Router()


// ── Signature verification function ──────────────────────────────────────────
// GitHub signs every webhook using HMAC-SHA256 with our secret.
// We recreate that signature locally and compare.
// If they match, the request is genuinely from GitHub.
// If they do not match, someone is faking the webhook — we reject it.
function verifyGithubSignature(body: string, signature: string): boolean {
  // Create our own signature using the same secret GitHub used
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET || '')
    .update(body)
    .digest('hex')

  // timingSafeEqual prevents timing attacks —
  // a normal string comparison leaks information about how many characters match
  // timingSafeEqual takes the same time regardless of how similar the strings are
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch {
    return false
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// POST /webhooks/github
// GitHub sends ALL webhook events here.
// The X-GitHub-Event header tells us what kind of event it is.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/github', async (req: Request, res: Response) => {

  // ── Step 1: Get the signature GitHub sent ────────────────────────────────
  // GitHub adds a signature header to every webhook request.
  // It looks like: "sha256=abc123..."
  // We use this to verify the request is genuine.
  const signature = req.headers['x-hub-signature-256'] as string

  if (!signature) {
    console.warn('Webhook received with no signature — rejecting')
    return res.status(401).json({
      error: 'MISSING_SIGNATURE',
      message: 'No webhook signature found in request headers',
    })
  }

  // ── Step 2: Verify the signature ─────────────────────────────────────────
  // We turn the request body back into a string for verification.
  // JSON.stringify recreates the exact string GitHub signed.
  const body = JSON.stringify(req.body)

  const isValid = verifyGithubSignature(body, signature)

  if (!isValid) {
    console.warn('Webhook signature verification failed — rejecting')
    return res.status(401).json({
      error: 'INVALID_SIGNATURE',
      message: 'Webhook signature does not match — request may be forged',
    })
  }

  // ── Step 3: Read the event type ───────────────────────────────────────────
  // The X-GitHub-Event header tells us what happened.
  // Examples: "pull_request", "pull_request_review", "ping"
  const eventType = req.headers['x-github-event'] as string

  console.log(`Webhook received: ${eventType}`)

  // ── Step 4: Handle the ping event ────────────────────────────────────────
  // When you first register a webhook, GitHub sends a "ping" event.
  // We just respond with 200 to confirm we received it.
  if (eventType === 'ping') {
    return res.status(200).json({ message: 'pong' })
  }

  // ── Step 5: Handle pull_request events ───────────────────────────────────
  // This fires when a PR is opened, closed, merged, updated, etc.
  if (eventType === 'pull_request') {
    const payload = req.body

    // The action tells us specifically what happened to the PR
    // Examples: "opened", "closed", "synchronize", "reopened"
    const action = payload.action

    // We only care about events that change PR data we store
    // "synchronize" means someone pushed new commits to the PR branch
    const relevantActions = ['opened', 'closed', 'merged', 'reopened', 'synchronize', 'edited']

    if (!relevantActions.includes(action)) {
      // We do not need to process this action — acknowledge and ignore
      return res.status(200).json({ message: `Action "${action}" ignored` })
    }

    // Get the GitHub repo ID from the webhook payload
    const githubRepoId = payload.repository?.id

    if (!githubRepoId) {
      return res.status(400).json({ error: 'No repository ID in payload' })
    }

    // Find this repository in our database
    // We match on githubId (the numeric GitHub ID, not our internal cuid)
    const repository = await prisma.repository.findUnique({
      where: { githubId: githubRepoId },
    })

    if (!repository) {
      // This repo is not connected to any DevFlow workspace — ignore it
      console.log(`Repository ${githubRepoId} not found in DB — ignoring webhook`)
      return res.status(200).json({ message: 'Repository not connected to DevFlow' })
    }

    // Add a job to the queue to sync this specific PR
    // The worker will pick it up and call the GitHub API to get full PR details
    await syncQueue.add(
      // Job name — useful for debugging in queue dashboards
      'sync-pr',
      {
        // Job data — everything the worker needs to do its job
        repositoryId: repository.id,
        workspaceId:  repository.workspaceId,
        fullName:     repository.fullName,
        prNumber:     payload.pull_request.number,
        // Use the token from our .env to authenticate GitHub API calls
        accessToken:  process.env.GITHUB_TOKEN || '',
      },
      {
        // jobId prevents duplicate jobs for the same PR
        // If two webhooks fire for PR #42 before the worker processes the first,
        // the second one is ignored — we only need to sync it once
        jobId: `pr-${repository.id}-${payload.pull_request.number}`,
      }
    )

    console.log(`Job queued: sync PR #${payload.pull_request.number} for ${repository.fullName}`)

    // Respond immediately — do not wait for the job to be processed
    // GitHub expects a response within 10 seconds or it marks the delivery as failed
    return res.status(200).json({
      message: 'Job queued successfully',
      prNumber: payload.pull_request.number,
    })
  }

  // ── Step 6: Handle pull_request_review events ────────────────────────────
  // This fires when someone submits a review on a PR
  if (eventType === 'pull_request_review') {
    const payload = req.body
    const githubRepoId = payload.repository?.id

    if (!githubRepoId) {
      return res.status(400).json({ error: 'No repository ID in payload' })
    }

    const repository = await prisma.repository.findUnique({
      where: { githubId: githubRepoId },
    })

    if (!repository) {
      return res.status(200).json({ message: 'Repository not connected to DevFlow' })
    }

    // When a review is submitted, re-sync the whole PR to get updated review counts
    await syncQueue.add(
      'sync-pr',
      {
        repositoryId: repository.id,
        workspaceId:  repository.workspaceId,
        fullName:     repository.fullName,
        prNumber:     payload.pull_request.number,
        accessToken:  process.env.GITHUB_TOKEN || '',
      },
      {
        jobId: `pr-${repository.id}-${payload.pull_request.number}-review`,
      }
    )

    console.log(`Job queued: sync PR #${payload.pull_request.number} after review`)
    return res.status(200).json({ message: 'Review sync job queued' })
  }

  // ── Step 7: Ignore all other event types ─────────────────────────────────
  // We only care about pull_request and pull_request_review events.
  // Any other event type gets a 200 response and is ignored.
  return res.status(200).json({ message: `Event type "${eventType}" not handled` })
})

export default router