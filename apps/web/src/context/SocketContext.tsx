// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS THIS FILE?
// Creates and manages the Socket.io WebSocket connection for the React app.
//
// One socket is created when the user is authenticated.
// It is shared across the entire app via React Context.
// Any component can call useSocket() to access it.
//
// The socket is automatically:
//   - Created when the user logs in
//   - Disconnected when the user logs out
//   - Reconnected if the connection drops
// ─────────────────────────────────────────────────────────────────────────────

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from 'react'
import { io, type Socket } from 'socket.io-client'
import { useAuth } from './AuthContext'

// ── Types ─────────────────────────────────────────────────────────────────────
// The shape of the PR update event sent by the server
export interface PRUpdateEvent {
  action:         'created' | 'updated' | 'merged' | 'closed'
  prNumber:       number
  title:          string
  state:          string
  authorUsername: string
}

// What the context provides to consumers
interface SocketContextValue {
  // The raw socket instance — null if not connected
  socket: Socket | null

  // Whether the socket is currently connected
  isConnected: boolean

  // Call this to join a repo room — starts receiving events for that repo
  joinRepo: (repoId: string) => void

  // Call this to leave a repo room — stops receiving events
  leaveRepo: (repoId: string) => void
}

// ── Create the context ────────────────────────────────────────────────────────
const SocketContext = createContext<SocketContextValue>({
  socket:      null,
  isConnected: false,
  joinRepo:    () => {},
  leaveRepo:   () => {},
})

// ── Provider component ────────────────────────────────────────────────────────
// Wrap the app in this to make useSocket() work everywhere.
export function SocketProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()

  // The socket instance — stored in a ref so it does not trigger re-renders
  // useRef is like useState but changing it does NOT cause a re-render
  // Perfect for storing things like socket connections and timers
  const socketRef = useRef<Socket | null>(null)

  // isConnected IS state because we want the UI to re-render when it changes
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // Only create the socket if the user is authenticated
    // No point connecting if not logged in — server would reject anyway
    if (!isAuthenticated) {
      // If user logs out, disconnect the existing socket
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
        setIsConnected(false)
      }
      return
    }

    // ── Create the socket connection ────────────────────────────────────────
    // io() creates a WebSocket connection to our API server.
    // withCredentials: true sends the auth cookie so the server knows who we are.
    const socket = io(
      import.meta.env.VITE_API_URL || 'http://localhost:4000',
      {
        // Send the auth cookie with the connection request
        withCredentials: true,

        // transports: try WebSocket first, fall back to long-polling if blocked
        // WebSocket is faster. Long-polling works even through strict firewalls.
        transports: ['websocket', 'polling'],

        // reconnection: automatically reconnect if the connection drops
        reconnection: true,

        // How many times to try reconnecting before giving up
        reconnectionAttempts: 5,

        // How long to wait between reconnection attempts (milliseconds)
        // Starts at 1s, doubles each time: 1s, 2s, 4s, 8s, 16s
        reconnectionDelay: 1000,
        reconnectionDelayMax: 16000,
      }
    )

    // Store socket in ref so other functions can access it
    socketRef.current = socket

    // ── Connection event handlers ───────────────────────────────────────────
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id)
      setIsConnected(true)
    })

    socket.on('disconnect', reason => {
      console.log('Socket disconnected:', reason)
      setIsConnected(false)
    })

    socket.on('connect_error', error => {
      // Connect error means the server rejected the connection
      // or the server is unreachable
      console.warn('Socket connection error:', error.message)
      setIsConnected(false)
    })

    // ── Cleanup ─────────────────────────────────────────────────────────────
    // This runs when the component unmounts OR when isAuthenticated changes.
    // We disconnect the socket to avoid memory leaks and orphaned connections.
    return () => {
      socket.disconnect()
      socketRef.current = null
      setIsConnected(false)
    }

  // Re-run this effect when authentication status changes
  }, [isAuthenticated])


  // ── joinRepo ──────────────────────────────────────────────────────────────
  // Tells the server to add this socket to the repo's room.
  // After calling this, the socket will receive pr:updated events for this repo.
  function joinRepo(repoId: string) {
    if (!socketRef.current?.connected) return
    socketRef.current.emit('join:repo', repoId)
    console.log('Joined repo room:', repoId)
  }

  // ── leaveRepo ─────────────────────────────────────────────────────────────
  // Tells the server to remove this socket from the repo's room.
  // Call this when navigating away from a repo's pages.
  function leaveRepo(repoId: string) {
    if (!socketRef.current?.connected) return
    socketRef.current.emit('leave:repo', repoId)
    console.log('Left repo room:', repoId)
  }

  return (
    <SocketContext.Provider value={{
      socket:      socketRef.current,
      isConnected,
      joinRepo,
      leaveRepo,
    }}>
      {children}
    </SocketContext.Provider>
  )
}

// ── useSocket hook ────────────────────────────────────────────────────────────
// Call this in any component to access the socket connection.
// Example:
//   const { socket, isConnected, joinRepo } = useSocket()
export function useSocket() {
  return useContext(SocketContext)
}