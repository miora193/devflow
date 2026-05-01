// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS THIS FILE?
// Four analytics endpoints that aggregate raw PR data into chart-ready data.
//
// All routes require authentication (requireAuth middleware).
// All routes accept a repoId URL parameter — analytics are per-repository.
// All routes accept an optional ?days=90 query param to control date range.
//
// The heavy lifting is done in the database with Prisma queries.
// We do the aggregation in Node.js after fetching from the DB.
// This is fine for our data sizes — for millions of rows we would use
// PostgreSQL aggregation functions directly.
// ─────────────────────────────────────────────────────────────────────────────

import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import {
  differenceInHours,
  differenceInDays,
  startOfWeek,
  format,
  subDays,
  eachWeekOfInterval,
  eachDayOfInterval,
  startOfDay,
  parseISO,
} from 'date-fns'

import { prisma } from '../index'
import type { AuthUser } from '@devflow/types'

const router = Router()


// ── requireAuth middleware ────────────────────────────────────────────────────
// Same pattern as repos.ts — verify JWT cookie before every route.
// Attaches req.user so route handlers know who is asking.
function requireAuth(req: Request, res: Response, next: Function) {
  const token = req.cookies?.auth_token

  if (!token) {
    return res.status(401).json({
      error: 'NOT_AUTHENTICATED',
      message: 'You must be logged in to view analytics',
    })
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET!) as AuthUser
    next()
  } catch {
    res.clearCookie('auth_token')
    return res.status(401).json({
      error: 'SESSION_EXPIRED',
      message: 'Your session has expired. Please log in again.',
    })
  }
}

router.use(requireAuth)


// ── Helper: get workspace and verify repo ownership ───────────────────────────
// Every analytics endpoint needs to:
// 1. Find the user's workspace
// 2. Confirm the requested repo belongs to that workspace
// We extract this into a helper to avoid repeating it in every route.
async function getRepoForUser(repoId: string, userId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: { ownerId: userId },
  })
  if (!workspace) return null

  const repo = await prisma.repository.findFirst({
    where: { id: repoId, workspaceId: workspace.id },
  })
  return repo
}


// ── Helper: get date range ────────────────────────────────────────────────────
// All endpoints accept ?days=90 to control how far back to look.
// Default is 90 days. Maximum is 365 days.
function getDateRange(daysParam: string | undefined): Date {
  const days = Math.min(365, Math.max(7, parseInt(daysParam || '90') || 90))
  return subDays(new Date(), days)
}


// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT 1: GET /analytics/:repoId/cycle-time
//
// Returns: one data point per merged PR showing how long it took.
// Used for: scatter plot where each dot is one PR.
//
// "Cycle time" = time from when a PR was opened to when it was merged.
// Short cycle times = fast reviews. Long cycle times = bottlenecks.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:repoId/cycle-time', async (req: Request, res: Response) => {
  const { repoId } = req.params

  const repo = await getRepoForUser(repoId, req.user!.id)
  if (!repo) return res.status(404).json({ error: 'Repository not found' })

  const since = getDateRange(req.query.days as string)

  // Fetch all MERGED pull requests in the date range.
  // We only calculate cycle time for merged PRs — closed without merging
  // does not tell us about review speed.
  const mergedPRs = await prisma.pullRequest.findMany({
    where: {
      repositoryId: repoId,
      state: 'merged',
      // githubMergedAt is when it was merged — we want PRs merged recently
      githubMergedAt: { gte: since },
    },
    // Most recently merged first
    orderBy: { githubMergedAt: 'desc' },
    // Limit to 200 so the chart does not get too crowded
    take: 200,
  })

  if (mergedPRs.length === 0) {
    return res.json({
      points: [],
      averageCycleTimeDays: 0,
      medianCycleTimeDays: 0,
      totalMergedPRs: 0,
    })
  }

  // Calculate cycle time for each PR
  const points = mergedPRs
    .filter((pr: any) => pr.githubMergedAt && pr.githubCreatedAt)
    .map((pr: any) => {
      const openedAt = new Date(pr.githubCreatedAt)
      const mergedAt = new Date(pr.githubMergedAt!)

      // differenceInHours from date-fns calculates exact hours between two dates
      const cycleTimeHours = differenceInHours(mergedAt, openedAt)
      const cycleTimeDays = differenceInDays(mergedAt, openedAt)

      return {
        prNumber: pr.githubNumber,
        title: pr.title,
        openedAt: pr.githubCreatedAt.toISOString(),
        cycleTimeHours,
        // Round to 1 decimal place for display e.g. "2.5 days"
        cycleTimeDays: Math.round(cycleTimeDays * 10) / 10,
        authorUsername: pr.authorUsername,
      }
    })
    // Filter out PRs with zero cycle time (likely test/draft PRs merged instantly)
    .filter(p => p.cycleTimeHours > 0)

  // Guard — if all PRs were filtered out (zero cycle time), return empty
  if (points.length === 0) {
    return res.json({
      points: [],
      averageCycleTimeDays: 0,
      medianCycleTimeDays: 0,
      totalMergedPRs: 0,
    })
  }

  // Calculate average cycle time
  const totalHours = points.reduce((sum, p) => sum + p.cycleTimeHours, 0)
  const averageDays = Math.round((totalHours / points.length / 24) * 10) / 10

  // Calculate median — sort by cycle time, take the middle value.
  // Median is better than average here because one very long PR
  // would skew the average badly.
  // We guard sorted.length > 0 above so this is safe.
  const sorted = [...points].sort((a, b) => a.cycleTimeHours - b.cycleTimeHours)
  const mid = Math.floor(sorted.length / 2)
  const medianHours = sorted.length === 1
    ? sorted[0].cycleTimeHours                                              // only one PR
    : sorted.length % 2 !== 0
      ? sorted[mid].cycleTimeHours                                          // odd count
      : (sorted[mid - 1].cycleTimeHours + sorted[mid].cycleTimeHours) / 2  // even count
  const medianDays = Math.round((medianHours / 24) * 10) / 10

  return res.json({
    points,
    averageCycleTimeDays: averageDays,
    medianCycleTimeDays: medianDays,
    totalMergedPRs: points.length,
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT 2: GET /analytics/:repoId/velocity
//
// Returns: one data point per week showing how many PRs were opened/merged.
// Used for: area chart showing team output over time.
//
// "Velocity" = how fast the team is shipping.
// Going up = shipping more. Flat/down = something blocking the team.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:repoId/velocity', async (req: Request, res: Response) => {
  const { repoId } = req.params

  const repo = await getRepoForUser(repoId, req.user!.id)
  if (!repo) return res.status(404).json({ error: 'Repository not found' })

  const since = getDateRange(req.query.days as string)

  // Fetch all PRs updated in the date range
  // We need both opened and merged dates so we fetch all and filter
  const prs = await prisma.pullRequest.findMany({
    where: {
      repositoryId: repoId,
      githubCreatedAt: { gte: since },
    },
    select: {
      // Only select the fields we need — faster query
      githubCreatedAt: true,
      githubMergedAt: true,
      state: true,
    },
  })

  if (prs.length === 0) {
    return res.json({ points: [], weeksOfData: 0, averageMergedPerWeek: 0 })
  }

  // Get every week in the date range using date-fns eachWeekOfInterval
  // This gives us an array of Date objects — one per week start (Monday)
  const weeks = eachWeekOfInterval(
    { start: since, end: new Date() },
    { weekStartsOn: 1 } // 1 = Monday
  )

  // For each week, count how many PRs were opened and merged
  const points = weeks.map(weekStart => {
    // End of this week = start of next week
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    // Count PRs opened this week
    const opened = prs.filter((pr: any) => {
      const opened = new Date(pr.githubCreatedAt)
      return opened >= weekStart && opened < weekEnd
    }).length


    // Count PRs merged this week
    const merged = prs.filter(pr => {
      if (!pr.githubMergedAt) return false
      const merged = new Date(pr.githubMergedAt)
      return merged >= weekStart && merged < weekEnd
    }).length

    return {
      weekStart: weekStart.toISOString(),
      // format from date-fns turns a Date into a readable string
      // "MMM d" = "Jan 15", "Feb 3" etc.
      weekLabel: format(weekStart, 'MMM d'),
      opened,
      merged,
    }
  })

  // Remove weeks at the end with no activity (trailing zeros look odd on chart)
  const lastActiveIndex = [...points].reverse().findIndex(p => p.opened > 0 || p.merged > 0)
  const trimmedPoints = lastActiveIndex >= 0
    ? points.slice(0, points.length - lastActiveIndex)
    : points

  // Calculate average PRs merged per week
  const totalMerged = trimmedPoints.reduce((sum, p) => sum + p.merged, 0)
  const avgMergedPerWeek = trimmedPoints.length > 0
    ? Math.round((totalMerged / trimmedPoints.length) * 10) / 10
    : 0

  return res.json({
    points: trimmedPoints,
    weeksOfData: trimmedPoints.length,
    averageMergedPerWeek: avgMergedPerWeek,
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT 3: GET /analytics/:repoId/review-depth
//
// Returns: one data point per author showing review thoroughness.
// Used for: bar chart comparing review depth by author.
//
// "Review depth" = how much discussion happens before a PR is merged.
// High numbers = thorough reviews. Low numbers = rubber stamping.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:repoId/review-depth', async (req: Request, res: Response) => {
  const { repoId } = req.params

  const repo = await getRepoForUser(repoId, req.user!.id)
  if (!repo) return res.status(404).json({ error: 'Repository not found' })

  const since = getDateRange(req.query.days as string)

  // Fetch PRs with their review counts
  const prs = await prisma.pullRequest.findMany({
    where: {
      repositoryId: repoId,
      githubCreatedAt: { gte: since },
    },
    select: {
      authorUsername: true,
      commentsCount: true,
      reviewsCount: true,
      // Include the actual reviews to count changes requested
      reviews: {
        select: { state: true }
      },
    },
  })

  if (prs.length === 0) {
    return res.json({ authors: [], totalPRsAnalysed: 0 })
  }

  // Group PRs by author using a Map
  // A Map is like an object but keys can be anything and it preserves insertion order
  const authorMap = new Map<string, {
    totalPRs: number
    totalComments: number
    totalReviews: number
    totalChangesRequested: number
  }>()

  for (const pr of prs) {
    const existing = authorMap.get(pr.authorUsername) || {
      totalPRs: 0,
      totalComments: 0,
      totalReviews: 0,
      totalChangesRequested: 0,
    }

    // Count how many times "CHANGES_REQUESTED" was used on this PR
    const changesRequested = pr.reviews.filter((r: any) => r.state === 'CHANGES_REQUESTED').length

    authorMap.set(pr.authorUsername, {
      totalPRs: existing.totalPRs + 1,
      totalComments: existing.totalComments + pr.commentsCount,
      totalReviews: existing.totalReviews + pr.reviewsCount,
      totalChangesRequested: existing.totalChangesRequested + changesRequested,
    })
  }

  // Convert Map to array and calculate averages
  const authors = Array.from(authorMap.entries())
    .map(([authorUsername, stats]) => ({
      authorUsername,
      totalPRs: stats.totalPRs,
      // Round to 1 decimal place: 2.3 comments per PR
      avgComments: Math.round((stats.totalComments / stats.totalPRs) * 10) / 10,
      avgReviews: Math.round((stats.totalReviews / stats.totalPRs) * 10) / 10,
      avgChangesRequested: Math.round((stats.totalChangesRequested / stats.totalPRs) * 10) / 10,
    }))
    // Sort by most PRs first so busiest authors appear first on the chart
    .sort((a, b) => b.totalPRs - a.totalPRs)
    // Limit to top 10 authors so the bar chart is not too crowded
    .slice(0, 10)

  return res.json({
    authors,
    totalPRsAnalysed: prs.length,
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT 4: GET /analytics/:repoId/heatmap
//
// Returns: one data point per day showing PR activity level.
// Used for: calendar heatmap where darker = more activity.
//
// Shows the annual pattern of team activity — sprints, holidays, crunch periods.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:repoId/heatmap', async (req: Request, res: Response) => {
  const { repoId } = req.params

  const repo = await getRepoForUser(repoId, req.user!.id)
  if (!repo) return res.status(404).json({ error: 'Repository not found' })

  // Heatmap always shows the last 365 days — one full year
  const since = subDays(new Date(), 365)

  // Fetch all PR activity dates in the last year
  const prs = await prisma.pullRequest.findMany({
    where: {
      repositoryId: repoId,
      githubCreatedAt: { gte: since },
    },
    select: {
      githubCreatedAt: true,
      githubUpdatedAt: true,
    },
  })

  // Create a map of date string → count
  // e.g. { "2026-03-15": 3, "2026-03-16": 1 }
  const countByDay = new Map<string, number>()

  for (const pr of prs) {
    // Count the day the PR was opened
    const openedDate = format(new Date(pr.githubCreatedAt), 'yyyy-MM-dd')
    countByDay.set(openedDate, (countByDay.get(openedDate) || 0) + 1)
  }

  // Get the maximum count on any single day
  // We need this to calculate intensity levels (0-4)
  const maxCount = Math.max(0, ...Array.from(countByDay.values()))

  // Get every day in the last 365 days
  const allDays = eachDayOfInterval({ start: since, end: new Date() })

  // Build the heatmap data — one entry per day
  const days = allDays.map(day => {
    const dateStr = format(day, 'yyyy-MM-dd')
    const count = countByDay.get(dateStr) || 0

    // Calculate intensity level 0-4 based on count relative to max
    // 0 = no activity, 4 = the busiest day
    let intensity: 0 | 1 | 2 | 3 | 4 = 0
    if (count > 0 && maxCount > 0) {
      const ratio = count / maxCount
      if (ratio > 0.75) intensity = 4
      else if (ratio > 0.5) intensity = 3
      else if (ratio > 0.25) intensity = 2
      else intensity = 1
    }

    return { date: dateStr, count, intensity }
  })

  return res.json({
    days,
    maxCount,
    totalPRs: prs.length,
  })
})


export default router