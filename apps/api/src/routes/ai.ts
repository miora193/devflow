// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS THIS FILE?
// The AI review endpoint. Streams an AI-generated analysis of a pull request
// back to the browser word by word using Server Sent Events (SSE).
//
// Flow:
//   1. Receive POST /ai/review/:prId
//   2. Fetch PR details from PostgreSQL
//   3. Build a prompt with PR metadata
//   4. Call OpenAI with stream: true
//   5. Forward each text chunk to browser via SSE
//   6. Send [DONE] when finished
// ─────────────────────────────────────────────────────────────────────────────

import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import OpenAI from 'openai'  // Groq is OpenAI-compatible — same SDK
import { prisma } from '../index'
import type { AuthUser } from '@devflow/types'

const router = Router()

// ── Create the OpenAI client ──────────────────────────────────────────────────
// The OpenAI constructor automatically reads OPENAI_API_KEY from the environment.
// We create it once here — it is lightweight and stateless.
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// })

// Groq uses the same OpenAI SDK format — just a different baseURL and key
const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
})

// ── requireAuth middleware ────────────────────────────────────────────────────
// Same pattern as other routes — verify JWT cookie before handling the request.
function requireAuth(req: Request, res: Response, next: Function) {
  const token = req.cookies?.auth_token
  if (!token) {
    return res.status(401).json({ error: 'NOT_AUTHENTICATED' })
  }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET!) as AuthUser
    next()
  } catch {
    res.clearCookie('auth_token')
    return res.status(401).json({ error: 'SESSION_EXPIRED' })
  }
}

router.use(requireAuth)


// ─────────────────────────────────────────────────────────────────────────────
// POST /ai/review/:prId
//
// Streams an AI analysis of the pull request back to the browser.
// Uses SSE (Server Sent Events) so words appear as they are generated.
//
// :prId is our internal PR ID (the cuid from the database)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/review/:prId', async (req: Request, res: Response) => {
  const { prId } = req.params

  // ── Step 1: Fetch the PR from the database ────────────────────────────────
  // We need the PR details to build the prompt.
  // We also include the repo name and review data.
  const pr = await prisma.pullRequest.findUnique({
    where: { id: prId },
    include: {
      // Include the parent repository so we have the repo name
      repository: {
        select: { fullName: true, defaultBranch: true },
      },
      // Include reviews to analyse review coverage
      reviews: {
        select: { state: true, reviewerUsername: true },
      },
    },
  })

  if (!pr) {
    return res.status(404).json({ error: 'PR_NOT_FOUND', message: 'Pull request not found' })
  }

  // ── Step 2: Verify the user has access to this PR ─────────────────────────
  // Check the PR belongs to a workspace owned by this user.
  const workspace = await prisma.workspace.findFirst({
    where: { ownerId: req.user!.id },
  })

  if (!workspace) {
    return res.status(403).json({ error: 'NO_WORKSPACE' })
  }

  const repo = await prisma.repository.findFirst({
    where: { id: pr.repositoryId, workspaceId: workspace.id },
  })

  if (!repo) {
    return res.status(403).json({ error: 'ACCESS_DENIED', message: 'You do not have access to this PR' })
  }

  // ── Step 3: Calculate some derived metrics for the prompt ─────────────────
  // These help the AI give more useful analysis.

  // How many days was the PR open before merging/closing?
  const openDate = new Date(pr.githubCreatedAt)
  const closeDate = pr.githubMergedAt
    ? new Date(pr.githubMergedAt)
    : pr.githubClosedAt
      ? new Date(pr.githubClosedAt)
      : new Date()

  const daysOpen = Math.round(
    (closeDate.getTime() - openDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  // Count review states
  const approvals = pr.reviews.filter((r: any) => r.state === 'APPROVED').length
  const changesReq = pr.reviews.filter((r: any) => r.state === 'CHANGES_REQUESTED').length
  const reviewers = [...new Set(pr.reviews.map((r: any) => r.reviewerUsername))]

  // Risk signals — things that might indicate a risky PR
  const isLargePR = pr.changedFiles > 20 || pr.additions + pr.deletions > 500
  const hasNoReview = pr.reviewsCount === 0
  const longCycle = daysOpen > 7

  // ── Step 4: Build the prompt ──────────────────────────────────────────────
  // The prompt tells the AI exactly what to analyse and how to respond.
  // Good prompts are specific and structured — vague prompts give vague answers.
  const prompt = `You are a senior software engineer reviewing a pull request. 
Analyse this PR and give actionable insights to the engineering team.

## Pull Request Details
- Repository: ${pr.repository.fullName}
- PR #${pr.githubNumber}: "${pr.title}"
- Author: @${pr.authorUsername}
- Branch: ${pr.headBranch} → ${pr.baseBranch}
- Status: ${pr.state}

## Code Changes
- Files changed: ${pr.changedFiles}
- Lines added: +${pr.additions}
- Lines removed: -${pr.deletions}
- Net change: ${pr.additions - pr.deletions > 0 ? '+' : ''}${pr.additions - pr.deletions} lines

## Timeline
- Days open: ${daysOpen} day${daysOpen !== 1 ? 's' : ''}
- Opened: ${new Date(pr.githubCreatedAt).toLocaleDateString()}
${pr.githubMergedAt ? `- Merged: ${new Date(pr.githubMergedAt).toLocaleDateString()}` : ''}
${pr.githubClosedAt && !pr.githubMergedAt ? `- Closed: ${new Date(pr.githubClosedAt).toLocaleDateString()}` : ''}

## Review Activity
- Total reviews: ${pr.reviewsCount}
- Approvals: ${approvals}
- Changes requested: ${changesReq}
- Unique reviewers: ${reviewers.length > 0 ? reviewers.join(', ') : 'none'}
- Comments: ${pr.commentsCount}

## Risk Signals
${isLargePR ? '⚠️ Large PR — many files or lines changed' : '✓ PR size looks reasonable'}
${hasNoReview ? '⚠️ No reviews recorded' : `✓ Has ${pr.reviewsCount} review(s)`}
${longCycle ? `⚠️ Long cycle time — ${daysOpen} days` : '✓ Reasonable cycle time'}

Please provide a structured analysis with these sections:
1. **Summary** — What kind of change is this likely to be? (2-3 sentences)
2. **Review coverage** — Is the review activity adequate for a PR of this size?
3. **Risk assessment** — What are the main risk signals, if any?
4. **Recommendations** — What should the team focus on or improve?

Keep the response concise and practical. Use plain language. No need to repeat the PR details back.`

  // ── Step 5: Set up SSE headers ────────────────────────────────────────────
  // These headers tell the browser: "this is a streaming response, keep reading."
  //
  // Content-Type: text/event-stream → SSE format
  // Cache-Control: no-cache          → do not cache streaming responses
  // Connection: keep-alive           → keep the connection open
  // X-Accel-Buffering: no            → disable nginx buffering (important for SSE)
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  // ── Helper: send one SSE chunk to the browser ─────────────────────────────
  // SSE format requires each message to start with "data: " and end with "\n\n"
  // We JSON.stringify the payload so the browser can parse it easily.
  function sendChunk(data: object) {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  // ── Step 6: Call OpenAI with streaming ────────────────────────────────────
  try {
    // stream: true tells OpenAI to send the response word by word
    // instead of waiting for the full response to be generated.
    const stream = await openai.chat.completions.create({
      //   model: 'gpt-4o-mini', // fast and cost-effective for this use case
      model: 'llama-3.1-8b-instant', // Groq's free fast model
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      // max_tokens limits how long the response can be
      // ~600 tokens ≈ ~450 words — enough for a useful analysis
      max_tokens: 600,
      temperature: 0.7, // 0 = deterministic, 1 = creative. 0.7 = balanced.
      stream: true,     // THIS is what enables streaming
    })

    // ── Step 7: Forward each chunk to the browser ─────────────────────────
    // The stream is an async iterator — we loop through each chunk as it arrives.
    // Each chunk contains a delta (the new content added since the last chunk).
    for await (const chunk of stream) {
      // chunk.choices[0].delta.content is the new text in this chunk.
      // It can be undefined for the first and last chunks.
      const content = chunk.choices[0]?.delta?.content

      if (content) {
        // Send this piece of text to the browser
        sendChunk({ content })
      }

      // chunk.choices[0].finish_reason is set when generation is complete.
      // 'stop' means the AI finished naturally.
      // 'length' means we hit max_tokens.
      if (chunk.choices[0]?.finish_reason) {
        break
      }
    }

    // ── Step 8: Signal completion ─────────────────────────────────────────
    // Send a special [DONE] message so the browser knows the stream is finished.
    sendChunk({ done: true })
    res.end()

    console.log(`AI review streamed for PR #${pr.githubNumber} in ${pr.repository.fullName}`)

  } catch (error: any) {
    // If OpenAI fails, send an error chunk so the browser can show a message
    console.error('OpenAI streaming error:', error.message)

    // Check for common errors and give helpful messages
    if (error.status === 401) {
      sendChunk({ error: 'Invalid OpenAI API key. Check your OPENAI_API_KEY in .env.' })
    } else if (error.status === 429) {
      sendChunk({ error: 'OpenAI rate limit hit. Please wait a moment and try again.' })
    } else if (error.status === 429 && error.message?.includes('quota')) {
      sendChunk({ error: 'OpenAI quota exceeded. Check your billing at platform.openai.com.' })
    } else {
      sendChunk({ error: 'AI analysis failed. Please try again.' })
    }

    res.end()
  }
})


// ─────────────────────────────────────────────────────────────────────────────
// POST /ai/review/:prId/quick
//
// Returns a quick one-line summary of the PR — no streaming.
// Used for the PR list to show a brief AI label next to each PR.
// Much cheaper and faster than the full analysis.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/review/:prId/quick', async (req: Request, res: Response) => {
  const { prId } = req.params

  const pr = await prisma.pullRequest.findUnique({
    where: { id: prId },
    select: {
      githubNumber: true,
      title: true,
      changedFiles: true,
      additions: true,
      deletions: true,
      reviewsCount: true,
      authorUsername: true,
    },
  })

  if (!pr) return res.status(404).json({ error: 'PR_NOT_FOUND' })

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 30, // very short — just a label
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: `PR: "${pr.title}", ${pr.changedFiles} files, +${pr.additions}/-${pr.deletions} lines, ${pr.reviewsCount} reviews.
                  Give a 4-6 word label for this PR type. Examples: "Refactor with broad impact", "Small bug fix", "Large feature addition", "Config change, low risk". Reply with ONLY the label, nothing else.`,
      }],
    })

    const label = response.choices[0]?.message?.content?.trim() || 'Code change'
    return res.json({ label })

  } catch (error: any) {
    console.error('Quick AI label error:', error.message)
    return res.json({ label: 'Code change' }) // graceful fallback
  }
})

export default router