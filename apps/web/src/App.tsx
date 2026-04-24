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

      <Route path="/test-chart" element={
  <ProtectedRoute>
    <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: '40px' }}>

      {/* Cycle time scatter plot */}
      <div>
        <h2 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>
          PR Cycle Time
        </h2>
        <CycleTimeChart data={{
          points: [
            { prNumber: 1, title: 'Add login page',    openedAt: '2026-01-05T10:00:00Z', cycleTimeHours: 48,  cycleTimeDays: 2,   authorUsername: 'danisha' },
            { prNumber: 2, title: 'Fix auth bug',      openedAt: '2026-01-12T10:00:00Z', cycleTimeHours: 24,  cycleTimeDays: 1,   authorUsername: 'danisha' },
            { prNumber: 3, title: 'Add PR list',       openedAt: '2026-01-20T10:00:00Z', cycleTimeHours: 96,  cycleTimeDays: 4,   authorUsername: 'fardin'  },
            { prNumber: 4, title: 'Docker setup',      openedAt: '2026-02-01T10:00:00Z', cycleTimeHours: 72,  cycleTimeDays: 3,   authorUsername: 'fardin'  },
            { prNumber: 5, title: 'Analytics API',     openedAt: '2026-02-15T10:00:00Z', cycleTimeHours: 120, cycleTimeDays: 5,   authorUsername: 'danisha' },
            { prNumber: 6, title: 'Webhook endpoint',  openedAt: '2026-03-01T10:00:00Z', cycleTimeHours: 36,  cycleTimeDays: 1.5, authorUsername: 'danisha' },
            { prNumber: 7, title: 'Redis queue',       openedAt: '2026-03-10T10:00:00Z', cycleTimeHours: 60,  cycleTimeDays: 2.5, authorUsername: 'fardin'  },
            { prNumber: 8, title: 'Sync worker',       openedAt: '2026-03-20T10:00:00Z', cycleTimeHours: 48,  cycleTimeDays: 2,   authorUsername: 'danisha' },
          ],
          averageCycleTimeDays: 2.6,
          medianCycleTimeDays:  2.5,
          totalMergedPRs:       8,
        }} />
      </div>

      {/* Velocity area chart */}
      <div>
        <h2 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>
          Team Velocity
        </h2>
        <VelocityChart data={{
          points: [
            { weekStart: '2026-01-06T00:00:00Z', weekLabel: 'Jan 6',  merged: 2, opened: 3 },
            { weekStart: '2026-01-13T00:00:00Z', weekLabel: 'Jan 13', merged: 1, opened: 2 },
            { weekStart: '2026-01-20T00:00:00Z', weekLabel: 'Jan 20', merged: 4, opened: 4 },
            { weekStart: '2026-01-27T00:00:00Z', weekLabel: 'Jan 27', merged: 3, opened: 5 },
            { weekStart: '2026-02-03T00:00:00Z', weekLabel: 'Feb 3',  merged: 5, opened: 4 },
            { weekStart: '2026-02-10T00:00:00Z', weekLabel: 'Feb 10', merged: 2, opened: 3 },
            { weekStart: '2026-02-17T00:00:00Z', weekLabel: 'Feb 17', merged: 6, opened: 6 },
            { weekStart: '2026-02-24T00:00:00Z', weekLabel: 'Feb 24', merged: 4, opened: 5 },
            { weekStart: '2026-03-03T00:00:00Z', weekLabel: 'Mar 3',  merged: 3, opened: 4 },
            { weekStart: '2026-03-10T00:00:00Z', weekLabel: 'Mar 10', merged: 5, opened: 5 },
            { weekStart: '2026-03-17T00:00:00Z', weekLabel: 'Mar 17', merged: 7, opened: 6 },
            { weekStart: '2026-03-24T00:00:00Z', weekLabel: 'Mar 24', merged: 4, opened: 4 },
          ],
          weeksOfData:          12,
          averageMergedPerWeek: 3.8,
        }} />
      </div>

    </div>
  </ProtectedRoute>
} />
    </Routes>
  )
}