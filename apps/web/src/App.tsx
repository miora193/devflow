// App.tsx — the route map of the entire React application.
// Every page URL gets defined here.

import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'

export default function App() {
  return (
    <Routes>
      {/* Public route — anyone can see the login page */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected route — only logged-in users can see the dashboard.
          ProtectedRoute checks authentication and redirects to /login if needed. */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      {/* Catch-all: any unknown URL redirects to /dashboard.
          ProtectedRoute handles sending unauthenticated users to /login. */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}