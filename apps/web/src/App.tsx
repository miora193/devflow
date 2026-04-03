// App.tsx — the route map of the entire application
//
// This file does one job: it says "if the URL is X, show component Y".
// Every page in the app gets registered here.
//
// We will add more routes as we build each phase.
// For now we just have a placeholder so the app starts without errors.

import { Routes, Route, Navigate } from 'react-router-dom'

// Placeholder pages — we will replace these with real pages in Step 11
function LoginPage() {
  return (
    <div style={{ padding: '40px', fontFamily: 'var(--font-sans)' }}>
      <h1>DevFlow</h1>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: '8px' }}>
        Login page — coming in Step 11
      </p>
    </div>
  )
}

function DashboardPage() {
  return (
    <div style={{ padding: '40px', fontFamily: 'var(--font-sans)' }}>
      <h1>Dashboard</h1>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: '8px' }}>
        Dashboard — coming in Step 11
      </p>
    </div>
  )
}

export default function App() {
  return (
    // Routes is the container for all our route definitions.
    // React Router looks at the current URL and renders the matching Route.
    <Routes>
      {/* Public route — anyone can visit /login */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected route — only logged-in users (protection added in Step 11) */}
      <Route path="/dashboard" element={<DashboardPage />} />

      {/* Default: if someone visits "/", redirect them to /dashboard */}
      {/* "replace" means the redirect does not create a history entry —
          pressing Back after a redirect does not bring you back to "/" */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}