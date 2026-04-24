// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS THIS FILE?
// This is the entry point of the API server — the first file that runs.
// It sets up Express (the web framework), adds middleware, registers routes,
// connects to the database, and starts listening for requests.
// ─────────────────────────────────────────────────────────────────────────────

// "dotenv" reads our .env file and loads all the variables into process.env
// so we can access them with process.env.PORT, process.env.JWT_SECRET, etc.
// This MUST be the very first import — before anything that might need those values.
import 'dotenv/config'

// Express is the web framework — it makes it easy to define routes like
// "when someone calls GET /health, run this function"
import express from 'express'

// cors = Cross-Origin Resource Sharing.
// By default, browsers BLOCK requests from one origin (localhost:5173)
// to a different origin (localhost:4000). CORS is how we say
// "I explicitly allow requests from localhost:5173."
import cors from 'cors'

// cookie-parser reads the cookies sent with each request and puts them
// on req.cookies so we can access them easily.
// Without this, req.cookies would be undefined.
import cookieParser from 'cookie-parser'

import { PrismaClient } from '@prisma/client'

// Import the auth router we just created
import authRoutes from './routes/auth'

// Import the webhook router
import webhookRoutes from './routes/webhooks'

// Import the sync worker — this starts it running in the background.
// The worker listens on the BullMQ queue and processes jobs automatically.
// It runs alongside the Express server in the same Node.js process.
import './workers/sync.worker'

import repoRoutes    from './routes/repos' 
import analyticsRoutes from './routes/analytics'


// Create the Prisma database client.
// We export this so any route file can import it:
//   import { prisma } from '../index'
export const prisma = new PrismaClient({
  // In development, log every SQL query so we can see what's happening.
  // In production, only log errors — too much logging slows things down.
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
})


// ── Create the Express app ────────────────────────────────────────────────────
// app is the main Express instance. We attach all middleware and routes to it.
const app = express()

// Read PORT from .env file, or use 4000 as the fallback if it is not set
const PORT = process.env.PORT || 4000

// ── Middleware ────────────────────────────────────────────────────────────────
// Middleware are functions that run on EVERY request before it reaches a route.
// Think of them as security guards and translators at the entrance.

// 1. JSON parser — reads the request body and turns JSON text into a JS object.
//    Without this, req.body would be undefined when someone POSTs JSON data.
app.use(express.json())

// 2. Cookie parser — reads cookies from the request headers.
//    After this runs, req.cookies.auth_token is accessible in every route.
app.use(cookieParser())

// 3. CORS — tells the browser which origins are allowed to call this API.
app.use(cors({
  // Only allow requests from our React frontend
  origin: process.env.CLIENT_URL || 'http://localhost:5173',

  // credentials: true is REQUIRED for cookies to work cross-origin.
  // Without this, the browser refuses to send our auth_token cookie.
  credentials: true,
}))

// Register auth routes under the /auth prefix.
// This means:
//   router.get('/github')          → GET /auth/github
//   router.get('/github/callback') → GET /auth/github/callback
//   router.get('/me')              → GET /auth/me
//   router.post('/logout')         → POST /auth/logout
app.use('/auth', authRoutes)


// Webhook routes — /webhooks/github
// GitHub sends events here when PRs are opened, updated, merged
app.use('/webhooks', webhookRoutes)



// ── Health check route ────────────────────────────────────────────────────────
// This is the simplest possible route — it just says "yes, I am alive."
// Docker uses this to know the container is healthy.
// You can test it by visiting http://localhost:4000/health in your browser.
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(), // current time in standard format
    environment: process.env.NODE_ENV,
  })
})

// ── Graceful shutdown ─────────────────────────────────────────────────────────
// When you press Ctrl+C to stop the server, Node fires the SIGINT signal.
// We listen for it and close the database connection cleanly before stopping.
// Without this, the database might have uncommitted transactions or open connections.
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...')
  await prisma.$disconnect()
  process.exit(0)
})

// ── Start the server ──────────────────────────────────────────────────────────
// app.listen tells Node to start accepting HTTP connections on this port.
// The callback function runs once when the server is ready.
app.listen(PORT, () => {
  console.log(`
  ┌─────────────────────────────────────┐
  │  DevFlow API running                │
  │  http://localhost:${PORT}               │
  │  Environment: ${process.env.NODE_ENV}         │
  └─────────────────────────────────────┘
  `)
})

// ...after the other app.use() lines:
app.use('/repos', repoRoutes)

app.use('/analytics', analyticsRoutes)

// Export app for testing purposes — test files can import the app
// without starting the server
export default app