// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS THIS FILE?
// A focused hook for components that want to receive real-time PR updates
// for a specific repository.
//
// It does three things automatically:
//   1. Joins the repo room when the component mounts
//   2. Calls your callback whenever a PR is updated
//   3. Leaves the repo room when the component unmounts
//
// Usage:
//   useRepoSocket(repoId, (event) => {
//     console.log('PR updated:', event.prNumber)
//   })
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react'
import { useSocket, type PRUpdateEvent } from '@/context/SocketContext'

export function useRepoSocket(
  repoId:   string,
  onUpdate: (event: PRUpdateEvent) => void
) {
  const { socket, isConnected, joinRepo, leaveRepo } = useSocket()

  useEffect(() => {
    // Only join if we have a valid repoId and an active connection
    if (!repoId || !isConnected || !socket) return

    // ── Join the repo room ──────────────────────────────────────────────────
    // This tells the server to add us to "repo:{repoId}"
    // From now on we receive pr:updated events for this repo
    joinRepo(repoId)

    // ── Listen for PR update events ─────────────────────────────────────────
    // "pr:updated" is the event name we chose in index.ts emitPRUpdate()
    // The payload matches the PRUpdateEvent interface above
    socket.on('pr:updated', onUpdate)

    // ── Cleanup ─────────────────────────────────────────────────────────────
    // When the component unmounts (user navigates away):
    //   1. Stop listening for events — prevents memory leaks
    //   2. Leave the room — server stops sending events to this socket
    return () => {
      socket.off('pr:updated', onUpdate)
      leaveRepo(repoId)
    }

  // Re-run when repoId or connection status changes
  // If the socket reconnects, we re-join the room automatically
  }, [repoId, isConnected, socket])
}