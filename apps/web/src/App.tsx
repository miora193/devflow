// App.tsx — the route map of the entire React application.
// Every page URL gets defined here.

import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import RepositoriesPage from '@/pages/RepositoriesPage'
import PullRequestsPage from '@/pages/PullRequestsPage'
import CycleTimeChart from '@/components/charts/CycleTimeChart'


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

      {/* Redirect root to repos page */}
      <Route path="/" element={<Navigate to="/repos" replace />} />
      <Route path="*" element={<Navigate to="/repos" replace />} />

      {/* Temporary test route — remove in Step 9 */}
      <Route path="/test-chart" element={
        <ProtectedRoute>
          <div style={{ padding: '40px' }}>
            <CycleTimeChart data={{
              points: [
                { prNumber: 1, title: 'Add login page', openedAt: '2026-01-05T10:00:00Z', cycleTimeHours: 48, cycleTimeDays: 2, authorUsername: 'danisha' },
                { prNumber: 2, title: 'Fix auth bug', openedAt: '2026-01-12T10:00:00Z', cycleTimeHours: 24, cycleTimeDays: 1, authorUsername: 'danisha' },
                { prNumber: 3, title: 'Add PR list', openedAt: '2026-01-20T10:00:00Z', cycleTimeHours: 96, cycleTimeDays: 4, authorUsername: 'fardin' },
                { prNumber: 4, title: 'Docker setup', openedAt: '2026-02-01T10:00:00Z', cycleTimeHours: 72, cycleTimeDays: 3, authorUsername: 'fardin' },
                { prNumber: 5, title: 'Analytics API', openedAt: '2026-02-15T10:00:00Z', cycleTimeHours: 120, cycleTimeDays: 5, authorUsername: 'danisha' },
                { prNumber: 6, title: 'Webhook endpoint', openedAt: '2026-03-01T10:00:00Z', cycleTimeHours: 36, cycleTimeDays: 1.5, authorUsername: 'danisha' },
                { prNumber: 7, title: 'Redis queue', openedAt: '2026-03-10T10:00:00Z', cycleTimeHours: 60, cycleTimeDays: 2.5, authorUsername: 'fardin' },
                { prNumber: 8, title: 'Sync worker', openedAt: '2026-03-20T10:00:00Z', cycleTimeHours: 48, cycleTimeDays: 2, authorUsername: 'danisha' },
              ],
              averageCycleTimeDays: 2.6,
              medianCycleTimeDays: 2.5,
              totalMergedPRs: 8,
            }} />
          </div>
        </ProtectedRoute>
      } />
    </Routes>
  )
}