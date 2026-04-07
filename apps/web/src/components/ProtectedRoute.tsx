// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS THIS FILE?
// ProtectedRoute is a wrapper component that guards pages.
// If you are logged in → show the page.
// If you are not logged in → redirect to /login.
//
// USAGE in App.tsx:
//   <Route path="/dashboard" element={
//     <ProtectedRoute>
//       <DashboardPage />
//     </ProtectedRoute>
//   } />
//
// Now DashboardPage is only visible to logged-in users.
// Anyone else gets sent to /login automatically.
// ─────────────────────────────────────────────────────────────────────────────

import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

interface Props {
  // children is the page component to show if the user is authenticated.
  // React.ReactNode means "any valid React content" — components, text, etc.
  children: React.ReactNode
}

export function ProtectedRoute({ children }: Props) {
  const { isAuthenticated, isLoading } = useAuth()

  // useLocation gives us the current URL path.
  // We save it so after login we can redirect back to where they were trying to go.
  const location = useLocation()

  // ── Still checking authentication status ─────────────────────────────────
  // When the app first loads, React Query is fetching /auth/me.
  // During this brief moment, isLoading is true and we do not know
  // if the user is logged in or not.
  // We show a loading state instead of incorrectly redirecting to login.
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'var(--font-sans)',
        color: 'var(--color-text-secondary)',
        fontSize: '14px',
        gap: '10px',
      }}>
        {/* Simple animated dot to show something is happening */}
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: 'var(--color-accent)',
          display: 'inline-block',
          animation: 'pulse 1.2s ease-in-out infinite',
        }} />
        Loading...
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(0.8); }
          }
        `}</style>
      </div>
    )
  }

  // ── Not authenticated — redirect to login ─────────────────────────────────
  if (!isAuthenticated) {
    // Navigate is React Router's component for redirecting.
    // state={{ from: location }} saves where they were trying to go.
    // After they log in, we can read this and send them back.
    // replace={true} means this redirect does not create a browser history entry.
    // So pressing the Back button does not bring them back to a page they
    // could not access anyway.
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // ── Authenticated — show the protected page ───────────────────────────────
  return <>{children}</>
}