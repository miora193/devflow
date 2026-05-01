// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS THIS FILE?
// The entry point of the entire backend.
// Phase 4 adds Socket.io on top of the existing Express server.
//
// The key change: instead of Express listening directly on a port,
// we wrap Express in a native Node.js HTTP server first.
// Socket.io attaches to that HTTP server.
// Both HTTP and WebSocket traffic go through the same port (4000).
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config'
import express         from 'express'
import cors            from 'cors'
import cookieParser    from 'cookie-parser'
import { createServer } from 'http'           // ← NEW: Node.js built-in HTTP server
import { Server }      from 'socket.io'       // ← NEW: Socket.io server
import { createAdapter } from '@socket.io/redis-adapter' // ← NEW: Redis adapter
import { createClient } from 'redis'          // ← NEW: Redis client for pub/sub
import { PrismaClient } from '@prisma/client'
import authRoutes      from './routes/auth'
import webhookRoutes   from './routes/webhooks'
import repoRoutes      from './routes/repos'
import analyticsRoutes from './routes/analytics'
import './workers/sync.worker'
import aiRoutes from './routes/ai'


// ── Prisma client ─────────────────────────────────────────────────────────────
// Created once and exported — every route file imports this single instance.
// Never create multiple PrismaClient instances — each holds a connection pool.
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
})

// ── Express app ───────────────────────────────────────────────────────────────
const app: express.Application = express()
const PORT = process.env.PORT || 4000

// ── Middleware ────────────────────────────────────────────────────────────────
// These run on every incoming HTTP request before route handlers.
app.use(express.json())
app.use(cookieParser())
app.use(cors({
  // Allow requests from the React app
  origin:      process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true, // required for cookies to be sent cross-origin
}))

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/auth',      authRoutes)
app.use('/webhooks',  webhookRoutes)
app.use('/repos',     repoRoutes)
app.use('/analytics', analyticsRoutes)

app.get('/health', (_req, res) => {
  res.json({
    status:      'ok',
    timestamp:   new Date().toISOString(),
    environment: process.env.NODE_ENV,
    websocket:   'enabled', // ← confirms Socket.io is running
  })
})

// ── HTTP server ───────────────────────────────────────────────────────────────
// We wrap Express in a native Node.js HTTP server.
// WHY? Socket.io needs an HTTP server to attach to, not just an Express app.
// The HTTP server handles both regular HTTP requests (Express) and
// WebSocket upgrade requests (Socket.io) on the same port.
const httpServer = createServer(app)

// ── Socket.io server ──────────────────────────────────────────────────────────
// Attach Socket.io to the HTTP server.
export const io = new Server(httpServer, {
  cors: {
    // Must match exactly — the browser sends this origin when connecting
    origin:      process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  },

  // pingTimeout: how long to wait for a pong before closing connection
  // If the browser tab is closed, the server knows within 20 seconds
  pingTimeout: 20000,

  // pingInterval: how often to send a ping to check the connection is alive
  pingInterval: 10000,
})

// ── Redis pub/sub clients ─────────────────────────────────────────────────────
// Socket.io's Redis adapter needs TWO separate Redis connections:
//   pubClient: publishes messages TO Redis
//   subClient: subscribes to messages FROM Redis
// They must be separate because a Redis connection in subscribe mode
// cannot be used for publishing — it is a Redis limitation.
//
// We use the standard "redis" npm package here (not ioredis) because
// the @socket.io/redis-adapter is designed to work with it.
// ioredis is still used by BullMQ separately.
const pubClient = createClient({ url: process.env.REDIS_URL || 'redis://redis:6379' })
const subClient = pubClient.duplicate() // duplicate creates an identical connection

// ── Connect Redis and set up the adapter ──────────────────────────────────────
// We must connect both clients before attaching the adapter.
// Promise.all connects both at the same time (parallel, not sequential).
Promise.all([pubClient.connect(), subClient.connect()])
  .then(() => {
    // Attach the Redis adapter to Socket.io
    // After this, any io.to().emit() call is automatically
    // distributed across all server instances via Redis
    io.adapter(createAdapter(pubClient, subClient))
    console.log('Socket.io Redis adapter connected')
  })
  .catch(err => {
    console.error('Failed to connect Redis adapter:', err)
  })


// ── Socket.io connection handler ─────────────────────────────────────────────
// This runs every time a browser connects via WebSocket.
io.on('connection', socket => {
  console.log(`Socket connected: ${socket.id}`)

  // ── Room joining ───────────────────────────────────────────────────────
  // Rooms are named channels. A browser can join a room to receive
  // only the events relevant to it.
  //
  // When a user opens a repo's PR list or analytics page,
  // the React app sends a "join:repo" event with the repoId.
  // We add that socket to a room named "repo:{repoId}".
  // Later, when a PR is updated, we emit ONLY to that room.
  socket.on('join:repo', (repoId: string) => {
    // Leave any previous repo room first
    // A user can only watch one repo at a time
    socket.rooms.forEach(room => {
      if (room.startsWith('repo:') && room !== `repo:${repoId}`) {
        socket.leave(room)
        console.log(`Socket ${socket.id} left room ${room}`)
      }
    })

    // Join the new room
    const roomName = `repo:${repoId}`
    socket.join(roomName)
    console.log(`Socket ${socket.id} joined room ${roomName}`)

    // Confirm to the browser that it joined successfully
    socket.emit('joined:repo', { repoId })
  })

  // ── Room leaving ───────────────────────────────────────────────────────
  socket.on('leave:repo', (repoId: string) => {
    socket.leave(`repo:${repoId}`)
    console.log(`Socket ${socket.id} left room repo:${repoId}`)
  })

  // ── Disconnection ──────────────────────────────────────────────────────
  socket.on('disconnect', reason => {
    console.log(`Socket disconnected: ${socket.id} — ${reason}`)
  })
})


// ── Helper: emit PR update to a repo room ─────────────────────────────────────
// This is exported so the sync worker can call it after saving a PR.
// It emits the "pr:updated" event to all browsers watching this repo.
//
// payload: the updated PR data to send to the browser
// repoId:  which repo room to emit to
export function emitPRUpdate(repoId: string, payload: {
  action:      'created' | 'updated' | 'merged' | 'closed'
  prNumber:    number
  title:       string
  state:       string
  authorUsername: string
}) {
  // io.to("repo:abc123").emit("pr:updated", payload)
  // This sends to ALL sockets that joined "repo:abc123"
  io.to(`repo:${repoId}`).emit('pr:updated', payload)
  console.log(`Emitted pr:updated to repo:${repoId} — PR #${payload.prNumber}`)
}


// ── Graceful shutdown ─────────────────────────────────────────────────────────
// When the process receives SIGINT (Ctrl+C), close everything cleanly.
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...')
  await prisma.$disconnect()
  await pubClient.disconnect()
  await subClient.disconnect()
  process.exit(0)
})

app.use('/ai', aiRoutes)

// ── Start the server ──────────────────────────────────────────────────────────
// Note: httpServer.listen() not app.listen()
// The HTTP server wraps Express AND Socket.io — both listen on port 4000.
httpServer.listen(PORT, () => {
  console.log(`
  ┌─────────────────────────────────────┐
  │  DevFlow API running                │
  │  http://localhost:${PORT}               │
  │  WebSocket: ws://localhost:${PORT}      │
  │  Environment: ${process.env.NODE_ENV}         │
  └─────────────────────────────────────┘
  `)
})

export default app