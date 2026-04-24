// App.tsx — the route map of the entire React application.
// Every page URL gets defined here.

import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import RepositoriesPage from '@/pages/RepositoriesPage'
import PullRequestsPage from '@/pages/PullRequestsPage'
import CycleTimeChart from '@/components/charts/CycleTimeChart'
import VelocityChart from '@/components/charts/VelocityChart'
import ReviewDepthChart from '@/components/charts/ReviewDepthChart'
import ActivityHeatmap from '@/components/charts/ActivityHeatmap'
import AnalyticsPage from '@/pages/AnalyticsPage'


export default function App() {
  return (
    <Routes>
      {/* Public route — anyone can see the login page */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected route — only logged-in users can see the dashboard.
          ProtectedRoute checks authentication and redirects to /login if needed. */}
      <Route path="/dashboard" element={
        <ProtectedRoute><DashboardPage /></ProtectedRoute>
      } />

      <Route path="/repos" element={
        <ProtectedRoute>
          <RepositoriesPage />
        </ProtectedRoute>
      } />

      <Route path="/repos/:id/pulls" element={
        <ProtectedRoute>
          <PullRequestsPage />
        </ProtectedRoute>
      } />

      <Route path="/repos/:id/analytics" element={
        <ProtectedRoute>
          <AnalyticsPage />
        </ProtectedRoute>
      } />

      {/* Redirect root to repos page */}
      <Route path="/" element={<Navigate to="/repos" replace />} />
      <Route path="*" element={<Navigate to="/repos" replace />} />

    </Routes>
  )
}