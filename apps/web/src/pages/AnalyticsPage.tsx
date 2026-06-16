// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS THIS FILE?
// The analytics dashboard page. Shows all four charts for a specific repo.
// URL: /repos/:id/analytics
//
// This page:
//   1. Reads the repoId from the URL params
//   2. Fetches all analytics data via useAnalyticsSummary hook
//   3. Shows summary stat cards at the top
//   4. Renders all four charts below
//   5. Has a time range filter (30 / 90 / 180 days)
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAnalyticsSummary } from '@/hooks/useAnalytics'
import CycleTimeChart   from '@/components/charts/CycleTimeChart'
import VelocityChart    from '@/components/charts/VelocityChart'
import ReviewDepthChart from '@/components/charts/ReviewDepthChart'
import ActivityHeatmap  from '@/components/charts/ActivityHeatmap'

// ── Types ─────────────────────────────────────────────────────────────────────
// The three time range options the user can select
type DaysOption = 30 | 90 | 180


// ── Stat card component ───────────────────────────────────────────────────────
// A small card showing one key number.
// Used in the header row: avg cycle time, total PRs, avg velocity, etc.
function StatCard({
  label,
  value,
  sub,
  colour = '#534AB7',
}: {
  label:   string
  value:   string | number
  sub?:    string
  colour?: string
}) {
  return (
    <div style={{
      background:   'var(--color-bg)',
      border:       '1px solid var(--color-border)',
      borderRadius: '10px',
      padding:      '16px 20px',
      flex:         1,
      minWidth:     '140px',
    }}>
      <p style={{
        fontSize:     '12px',
        color:        'var(--color-text-secondary)',
        margin:       '0 0 6px',
        fontWeight:   500,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}>
        {label}
      </p>
      <p style={{
        fontSize:   '26px',
        fontWeight: 600,
        color:      colour,
        margin:     '0 0 2px',
        lineHeight: 1,
      }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>
          {sub}
        </p>
      )}
    </div>
  )
}


// ── Chart section wrapper ─────────────────────────────────────────────────────
// Wraps each chart in a card with a title and optional subtitle.
function ChartCard({
  title,
  subtitle,
  children,
}: {
  title:     string
  subtitle?: string
  children:  React.ReactNode
}) {
  return (
    <div style={{
      background:   'var(--color-bg)',
      border:       '1px solid var(--color-border)',
      borderRadius: '12px',
      padding:      '20px 24px',
      marginBottom: '20px',
    }}>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{
          fontSize:   '15px',
          fontWeight: 600,
          margin:     '0 0 4px',
          color:      'var(--color-text-primary)',
        }}>
          {title}
        </h3>
        {subtitle && (
          <p style={{
            fontSize: '12px',
            color:    'var(--color-text-secondary)',
            margin:   0,
          }}>
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  )
}


// ── Loading skeleton ──────────────────────────────────────────────────────────
// Shown while data is fetching.
// A skeleton is a grey placeholder that has the same shape as the real content.
// Better UX than a spinner because the user can see the layout before data loads.
function Skeleton({ height = 320 }: { height?: number }) {
  return (
    <div style={{
      height:       `${height}px`,
      background:   'linear-gradient(90deg, var(--color-bg-subtle) 25%, var(--color-border) 50%, var(--color-bg-subtle) 75%)',
      backgroundSize: '200% 100%',
      borderRadius: '8px',
      animation:    'shimmer 1.5s infinite',
    }} />
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()

  // ── Time range state ──────────────────────────────────────────────────────
  // Controls how many days back all charts look.
  // Changing this re-fetches all four charts automatically via React Query.
  const [days, setDays] = useState<DaysOption>(90)

  // ── Fetch all analytics data ──────────────────────────────────────────────
  // useAnalyticsSummary calls all four hooks at once.
  // Each hook independently manages its own loading and error state.
  const { cycleTime, velocity, reviewDepth, heatmap, isLoading } =
    useAnalyticsSummary(id!, days)


  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight:  '100vh',
      background: 'var(--color-bg-subtle)',
      fontFamily: 'var(--font-sans)',
    }}>

      {/* ── Navigation bar ──────────────────────────────────────────────── */}
      <nav style={{
        background:     'var(--color-bg)',
        borderBottom:   '1px solid var(--color-border)',
        padding:        '0 24px',
        height:         '60px',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Back button — goes to PR list for this repo */}
          <button
            onClick={() => navigate(`/repos/${id}/pulls`)}
            style={{
              background: 'none',
              border:     'none',
              cursor:     'pointer',
              fontSize:   '14px',
              color:      'var(--color-text-secondary)',
            }}
          >
            ← Pull Requests
          </button>
          <span style={{ color: 'var(--color-border)', fontSize: '18px' }}>|</span>
          <span style={{ fontWeight: 600, fontSize: '16px' }}>Analytics</span>
        </div>

        {/* ── Days filter tabs ──────────────────────────────────────────── */}
        {/* Clicking a tab re-fetches all charts for that time range */}
        <div style={{
          display:      'flex',
          gap:          '4px',
          background:   'var(--color-bg-subtle)',
          border:       '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding:      '3px',
        }}>
          {([30, 90, 180] as DaysOption[]).map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              style={{
                padding:      '5px 12px',
                borderRadius: '6px',
                border:       'none',
                fontSize:     '12px',
                fontWeight:   days === d ? 500 : 400,
                cursor:       'pointer',
                background:   days === d ? 'var(--color-bg)' : 'transparent',
                color:        days === d ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                boxShadow:    days === d ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition:   'all 0.15s',
              }}
            >
              {d}d
            </button>
          ))}
        </div>
      </nav>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Page title ──────────────────────────────────────────────── */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{
            fontSize:      '22px',
            fontWeight:    600,
            margin:        '0 0 4px',
            letterSpacing: '-0.3px',
          }}>
            Repository Analytics
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', margin: 0, fontSize: '14px' }}>
            Last {days} days of PR activity
          </p>
        </div>

        {/* ── Summary stat cards ───────────────────────────────────────── */}
        {/* Four numbers at a glance before the charts */}
        <div style={{
          display:       'flex',
          gap:           '12px',
          marginBottom:  '24px',
          flexWrap:      'wrap',
        }}>
          {isLoading ? (
            // Show skeleton cards while loading
            [1,2,3,4].map(i => (
              <div key={i} style={{
                flex:         1,
                minWidth:     '140px',
                height:       '88px',
                background:   'var(--color-bg)',
                border:       '1px solid var(--color-border)',
                borderRadius: '10px',
              }} />
            ))
          ) : (
            <>
              <StatCard
                label="Avg cycle time"
                value={`${cycleTime.data?.averageCycleTimeDays ?? 0}d`}
                sub={`Median: ${cycleTime.data?.medianCycleTimeDays ?? 0}d`}
                colour="#534AB7"
              />
              <StatCard
                label="PRs merged"
                value={cycleTime.data?.totalMergedPRs ?? 0}
                sub={`in last ${days} days`}
                colour="#1D9E75"
              />
              <StatCard
                label="Avg per week"
                value={velocity.data?.averageMergedPerWeek ?? 0}
                sub={`over ${velocity.data?.weeksOfData ?? 0} weeks`}
                colour="#BA7517"
              />
              <StatCard
                label="PRs analysed"
                value={reviewDepth.data?.totalPRsAnalysed ?? 0}
                sub="for review depth"
                colour="#E24B4A"
              />
            </>
          )}
        </div>

        {/* ── Chart 1: Cycle Time ──────────────────────────────────────── */}
        <ChartCard
          title="PR Cycle Time"
          subtitle="How long each merged PR took from open to merge. Trend line shows direction over time."
        >
          {cycleTime.isLoading ? (
            <Skeleton height={380} />
          ) : cycleTime.isError ? (
            <p style={{ color: '#DC2626', fontSize: '13px' }}>
              Failed to load cycle time data
            </p>
          ) : (
            <CycleTimeChart
              data={cycleTime.data ?? { points: [], averageCycleTimeDays: 0, medianCycleTimeDays: 0, totalMergedPRs: 0 }}
              // width is handled by the parent container — we pass a large value
              // and the SVG overflows naturally on desktop
              width={Math.min(1050, window.innerWidth - 120)}
              height={380}
            />
          )}
        </ChartCard>

        {/* ── Chart 2: Team Velocity ───────────────────────────────────── */}
        <ChartCard
          title="Team Velocity"
          subtitle="PRs merged (purple) and opened (teal dashed) per week. Gap between lines = growing backlog."
        >
          {velocity.isLoading ? (
            <Skeleton height={320} />
          ) : velocity.isError ? (
            <p style={{ color: '#DC2626', fontSize: '13px' }}>
              Failed to load velocity data
            </p>
          ) : (
            <VelocityChart
              data={velocity.data ?? { points: [], weeksOfData: 0, averageMergedPerWeek: 0 }}
              height={320}
            />
          )}
        </ChartCard>

        {/* ── Chart 3: Review Depth ────────────────────────────────────── */}
        <ChartCard
          title="Review Depth by Author"
          subtitle="Average comments, reviews, and changes requested per PR — grouped by author."
        >
          {reviewDepth.isLoading ? (
            <Skeleton height={320} />
          ) : reviewDepth.isError ? (
            <p style={{ color: '#DC2626', fontSize: '13px' }}>
              Failed to load review data
            </p>
          ) : (
            <ReviewDepthChart
              data={reviewDepth.data ?? { authors: [], totalPRsAnalysed: 0 }}
              height={320}
            />
          )}
        </ChartCard>

        {/* ── Chart 4: Activity Heatmap ────────────────────────────────── */}
        <ChartCard
          title="PR Activity — Last 365 Days"
          subtitle="Each square is one day. Darker = more PRs opened. Hover to see exact count."
        >
          {heatmap.isLoading ? (
            <Skeleton height={140} />
          ) : heatmap.isError ? (
            <p style={{ color: '#DC2626', fontSize: '13px' }}>
              Failed to load heatmap data
            </p>
          ) : (
            <ActivityHeatmap
              data={heatmap.data ?? { days: [], maxCount: 0, totalPRs: 0 }}
            />
          )}
        </ChartCard>

      </main>

      {/* ── Shimmer animation keyframes ──────────────────────────────────── */}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}