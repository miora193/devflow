// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS THIS FILE?
// This file creates and exports our BullMQ queue.
//
// A queue is like a to-do list stored in Redis.
// When a webhook arrives, we ADD a job to this list.
// The sync worker (built in Step 7) READS from this list and processes jobs.
//
// WHY USE A QUEUE INSTEAD OF PROCESSING IMMEDIATELY?
// Imagine 50 webhooks arrive at the same second (a big PR review session).
// If we process each one instantly, we make 50 simultaneous GitHub API calls.
// GitHub has rate limits — we would get blocked.
// With a queue, jobs wait their turn and get processed one by one, safely.
// ─────────────────────────────────────────────────────────────────────────────

import { Queue } from 'bullmq'

// ioredis is the Redis client — it connects to Redis
// BullMQ uses this connection to store and read jobs
import IORedis from 'ioredis'

// ── Create the Redis connection ───────────────────────────────────────────────
// This connects to Redis running in our Docker container.
// process.env.REDIS_URL reads from .env — "redis://redis:6379"
// The "redis" hostname works inside Docker because of the network we set up.
// maxRetriesPerRequest: null is required by BullMQ — it handles retries itself
export const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://redis:6379', {
  // BullMQ requires this setting — without it BullMQ throws an error on startup
  // It means "do not limit how many times ioredis retries a failed command"
  // BullMQ manages its own retry logic so we do not want ioredis interfering
  maxRetriesPerRequest: null,
})

// ── Create the sync queue ─────────────────────────────────────────────────────
// "devflow:sync" is the queue name — just a label stored in Redis
// All jobs added to this queue are stored under this name
// The worker listens on this exact same name to pick up jobs
export const syncQueue = new Queue('devflow-sync', {
  connection: redisConnection,

  defaultJobOptions: {
    // How many times to retry a job if it fails
    // e.g. if the GitHub API is temporarily down, retry up to 3 times
    attempts: 3,

    backoff: {
      // "exponential" means wait longer between each retry
      // Retry 1: wait 2 seconds
      // Retry 2: wait 4 seconds
      // Retry 3: wait 8 seconds
      // This prevents hammering a service that is temporarily down
      type: 'exponential',
      delay: 2000,
    },

    // Remove completed jobs after 24 hours
    // Without this, Redis fills up with old completed jobs
    removeOnComplete: {
      age: 24 * 60 * 60, // 24 hours in seconds
    },

    // Keep failed jobs for 7 days so we can inspect what went wrong
    removeOnFail: {
      age: 7 * 24 * 60 * 60, // 7 days in seconds
    },
  },
})

// Log when Redis connects successfully
redisConnection.on('connect', () => {
  console.log('Redis connected successfully')
})

// Log if Redis connection fails
redisConnection.on('error', (err) => {
  console.error('Redis connection error:', err)
})