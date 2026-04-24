// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS THIS FILE?
// This is the sync worker — it reads jobs from the BullMQ queue
// and processes them one by one.
//
// A "worker" in BullMQ is just a function that says:
// "I am listening on this queue. When a job arrives, run this function."
//
// Our worker handles two types of jobs:
//   "sync-pr"   → fetch one specific PR from GitHub and save it to the DB
//   "sync-repo" → fetch ALL PRs for a repo (used on first connect)
//
// The worker runs INSIDE the same Node.js process as the API server.
// It runs in the background — it does not block the API from handling requests.
// ─────────────────────────────────────────────────────────────────────────────

import { Worker, Job } from 'bullmq'
import { prisma, emitPRUpdate } from '../index'
import { redisConnection } from '../queues/sync.queue'
import { createGithubClient, parseFullName } from '../lib/github'
import type { SyncPRJobData, SyncRepoJobData } from '@devflow/types'

// ── processSyncPR ─────────────────────────────────────────────────────────────
// Fetches one PR from GitHub and saves it to the database.
// Called when a webhook fires for a single PR event.
async function processSyncPR(data: SyncPRJobData): Promise<void> {
  const { repositoryId, fullName, prNumber, accessToken } = data

  // Create an authenticated GitHub client for this request
  const octokit = createGithubClient(accessToken)

  // Split "owner/repo" into separate parts for the API call
  const { owner, repo } = parseFullName(fullName)

  console.log(`Syncing PR #${prNumber} for ${fullName}...`)

  // ── Fetch the PR from GitHub ──────────────────────────────────────────────
  // octokit.rest.pulls.get fetches a single PR by its number
  // GitHub returns a large object — we only save the fields we need
  const { data: pr } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  })

  // ── Determine the PR state ────────────────────────────────────────────────
  // GitHub only has "open" and "closed" states on the PR object.
  // "merged" is not a state — it is a closed PR with merged_at set.
  // We check merged_at to distinguish "closed" from "merged".
  let state: string
  if (pr.merged_at) {
    state = 'merged'
  } else if (pr.state === 'closed') {
    state = 'closed'
  } else {
    state = 'open'
  }

  // ── Save or update the PR in our database ─────────────────────────────────
  // "upsert" = update if exists, create if not.
  // We use repositoryId + githubNumber as the unique identifier.
  // This means if the same PR webhook fires twice, we just update — no duplicates.
  await prisma.pullRequest.upsert({
    where: {
      // This matches the @@unique([repositoryId, githubNumber]) in our schema
      repositoryId_githubNumber: {
        repositoryId,
        githubNumber: pr.number,
      },
    },

    update: {
      // Fields that can change after a PR is created
      title:          pr.title,
      state,
      authorAvatarUrl: pr.user?.avatar_url || '',
      githubUrl:      pr.html_url,
      commentsCount:  pr.comments,
      changedFiles:   pr.changed_files || 0,
      additions:      pr.additions || 0,
      deletions:      pr.deletions || 0,
      githubUpdatedAt: new Date(pr.updated_at),
      githubMergedAt:  pr.merged_at ? new Date(pr.merged_at) : null,
      githubClosedAt:  pr.closed_at ? new Date(pr.closed_at) : null,
    },

    create: {
      // All fields needed when creating a new PR record
      githubNumber:    pr.number,
      title:           pr.title,
      state,
      authorUsername:  pr.user?.login || '',
      authorAvatarUrl: pr.user?.avatar_url || '',
      baseBranch:      pr.base.ref,
      headBranch:      pr.head.ref,
      githubUrl:       pr.html_url,
      commentsCount:   pr.comments,
      reviewsCount:    0,
      changedFiles:    pr.changed_files || 0,
      additions:       pr.additions || 0,
      deletions:       pr.deletions || 0,
      githubCreatedAt: new Date(pr.created_at),
      githubUpdatedAt: new Date(pr.updated_at),
      githubMergedAt:  pr.merged_at ? new Date(pr.merged_at) : null,
      githubClosedAt:  pr.closed_at ? new Date(pr.closed_at) : null,
      repositoryId,
    },
  })

// ── Fetch and save reviews for this PR ────────────────────────────────────
  // After saving the PR, fetch its reviews and save them too
  await syncReviewsForPR(octokit, owner, repo, pr.number, repositoryId)

  // ── Emit real-time update ─────────────────────────────────────────────────
  // Now that the PR is saved to the database, tell all browsers
  // that are watching this repo about the change.
  //
  // emitPRUpdate publishes to Redis → Socket.io picks it up →
  // forwards to all browsers in the "repo:{repositoryId}" room.
  //
  // We determine the "action" based on the PR state:
  // merged  = PR was merged
  // closed  = PR was closed without merging
  // created = PR is new (we check if it existed before — simpler to use state)
  // updated = anything else (new commits, title change, etc.)
  const action =
    state === 'merged'  ? 'merged'  :
    state === 'closed'  ? 'closed'  :
    pr.created_at === pr.updated_at ? 'created' : 'updated'

  emitPRUpdate(repositoryId, {
    action,
    prNumber:       pr.number,
    title:          pr.title,
    state,
    authorUsername: pr.user?.login || '',
  })

  console.log(`PR #${prNumber} synced successfully for ${fullName}`)
}


// ── syncReviewsForPR ──────────────────────────────────────────────────────────
// Fetches all reviews for a PR and saves them to the database.
// Also updates the reviewsCount on the PR record.
async function syncReviewsForPR(
  octokit: Awaited<ReturnType<typeof createGithubClient>>,
  owner: string,
  repo: string,
  prNumber: number,
  repositoryId: string
): Promise<void> {

  // Find the PR record in our database
  const prRecord = await prisma.pullRequest.findUnique({
    where: {
      repositoryId_githubNumber: {
        repositoryId,
        githubNumber: prNumber,
      },
    },
  })

  // If somehow the PR does not exist, skip
  if (!prRecord) return

  // Fetch all reviews from GitHub for this PR
  const { data: reviews } = await octokit.rest.pulls.listReviews({
    owner,
    repo,
    pull_number: prNumber,
  })

  // Save each review to the database
  // We use upsert again — if the review already exists, update it
  for (const review of reviews) {
    // Skip reviews with no state (drafts etc.)
    if (!review.state) continue

    await prisma.review.upsert({
      where: {
        // githubId is unique per review
        githubId: review.id,
      },
      update: {
        state:            review.state as any,
        body:             review.body || '',
        githubSubmittedAt: review.submitted_at
          ? new Date(review.submitted_at)
          : new Date(),
      },
      create: {
        githubId:          review.id,
        state:             review.state as any,
        reviewerUsername:  review.user?.login || '',
        reviewerAvatarUrl: review.user?.avatar_url || '',
        body:              review.body || '',
        githubSubmittedAt: review.submitted_at
          ? new Date(review.submitted_at)
          : new Date(),
        pullRequestId:     prRecord.id,
      },
    })
  }

  // Update the reviewsCount on the PR record
  await prisma.pullRequest.update({
    where: { id: prRecord.id },
    data:  { reviewsCount: reviews.length },
  })
}


// ── processSyncRepo ───────────────────────────────────────────────────────────
// Fetches ALL pull requests for a repository and saves them.
// Used when a user first connects a repository to DevFlow.
// This fills in the PR history before webhooks were set up.
async function processSyncRepo(data: SyncRepoJobData): Promise<void> {
  const { repositoryId, fullName, accessToken } = data

  const octokit = createGithubClient(accessToken)
  const { owner, repo } = parseFullName(fullName)

  console.log(`Starting full sync for ${fullName}...`)

  // Fetch all PRs — both open and closed
  // GitHub paginates results — perPage: 100 is the maximum per request
  // We fetch page by page until there are no more results
  let page = 1
  let totalSynced = 0

  while (true) {
    // Fetch one page of PRs
    const { data: prs } = await octokit.rest.pulls.list({
      owner,
      repo,
      // "all" means fetch open, closed, AND merged PRs
      state:    'all',
      per_page: 100,
      page,
    })

    // If this page has no PRs, we have fetched everything — stop
    if (prs.length === 0) break

    // Process each PR on this page
    for (const pr of prs) {
      // For a full repo sync, we fetch each PR individually
      // to get the full details (changed_files, additions, deletions
      // are not included in the list endpoint)
      await processSyncPR({
        repositoryId,
        workspaceId: data.workspaceId,
        fullName,
        prNumber:    pr.number,
        accessToken,
      })

      totalSynced++
    }

    console.log(`Synced ${totalSynced} PRs for ${fullName} so far...`)

    // Move to the next page
    page++

    // Safety limit — never sync more than 500 PRs in one job
    // This prevents runaway jobs on repos with thousands of old PRs
    if (totalSynced >= 500) {
      console.log(`Reached 500 PR limit for ${fullName} — stopping`)
      break
    }
  }

  // Mark the repository as synced with the current timestamp
  await prisma.repository.update({
    where: { id: repositoryId },
    data:  { lastSyncedAt: new Date() },
  })

  console.log(`Full sync complete for ${fullName} — ${totalSynced} PRs synced`)
}


// ─────────────────────────────────────────────────────────────────────────────
// CREATE THE WORKER
// This is what actually listens on the queue and processes jobs.
// It runs in the background alongside the Express server.
// ─────────────────────────────────────────────────────────────────────────────
export const syncWorker = new Worker(
  // Must match the queue name exactly — 'devflow-sync'
  'devflow-sync',

  // This function runs for every job the worker picks up
  // job.name tells us which type of job it is
  // job.data contains the payload we added when we queued the job
  async (job: Job) => {
    console.log(`Processing job: ${job.name} (id: ${job.id})`)

    if (job.name === 'sync-pr') {
      // Single PR sync — triggered by webhook
      await processSyncPR(job.data as SyncPRJobData)

    } else if (job.name === 'sync-repo') {
      // Full repo sync — triggered by manual sync
      await processSyncRepo(job.data as SyncRepoJobData)

    } else {
      console.warn(`Unknown job type: ${job.name}`)
    }
  },

  {
    // Use the same Redis connection as the queue
    connection: redisConnection,

    // concurrency: how many jobs to process at the same time
    // 1 means process one job at a time — safe for GitHub API rate limits
    // GitHub allows 5000 requests per hour — we do not want to hammer it
    concurrency: 1,
  }
)

// ── Worker event handlers ─────────────────────────────────────────────────────
// These log what is happening with jobs — helpful for debugging

syncWorker.on('completed', (job) => {
  // Job finished successfully
  console.log(`Job completed: ${job.name} (id: ${job.id})`)
})

syncWorker.on('failed', (job, error) => {
  // Job failed — BullMQ will retry based on our attempts setting
  console.error(`Job failed: ${job?.name} (id: ${job?.id})`, error.message)
})

syncWorker.on('active', (job) => {
  // Job started processing
  console.log(`Job started: ${job.name} (id: ${job.id})`)
})