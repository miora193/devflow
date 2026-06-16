// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS THIS FILE?
// A stacked area chart showing how many PRs were opened and merged each week.
//
// Built with Recharts because this is a standard chart type it handles well.
// Each data point = one week.
// Two areas: merged PRs (solid) and opened PRs (lighter behind it).
// ─────────────────────────────────────────────────────────────────────────────

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { VelocityData } from '@devflow/types'

// ── Props ─────────────────────────────────────────────────────────────────────
interface VelocityChartProps {
  data:    VelocityData
  height?: number
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
// Recharts lets us replace the default tooltip with our own component.
// This is called when the user hovers over a point on the chart.
// "active" = is the tooltip currently showing
// "payload" = the data values for the hovered point
// "label"   = the X axis label for the hovered point (week label)
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div style={{
      background:   'var(--color-bg)',
      border:       '1px solid var(--color-border)',
      borderRadius: '8px',
      padding:      '10px 14px',
      fontSize:     '12px',
      lineHeight:   1.7,
      boxShadow:    '0 4px 12px rgba(0,0,0,0.08)',
    }}>
      {/* Week label e.g. "Jan 15" */}
      <p style={{ fontWeight: 500, marginBottom: '4px', fontSize: '13px' }}>
        Week of {label}
      </p>

      {/* Loop through both data series (merged and opened) */}
      {payload.map((entry: any) => (
        <p key={entry.dataKey} style={{ color: entry.color, margin: 0 }}>
          {entry.dataKey === 'merged' ? 'Merged' : 'Opened'}: <strong>{entry.value} PRs</strong>
        </p>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function VelocityChart({ data, height = 320 }: VelocityChartProps) {

  // ── Empty state ───────────────────────────────────────────────────────────
  if (data.points.length === 0) {
    return (
      <div style={{
        height:         `${height}px`,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        color:          'var(--color-text-secondary)',
        fontSize:       '14px',
        border:         '1px dashed var(--color-border)',
        borderRadius:   '8px',
      }}>
        No PR data found in this time range
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    // ResponsiveContainer makes the chart fill its parent width automatically.
    // width="100%" means "take up all available width."
    // This is why we do not hardcode a pixel width like we did in D3.
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
        data={data.points}
        // margin creates space for axis labels
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        {/* ── Gradient definitions ─────────────────────────────────────── */}
        {/* SVG defs let us define gradients to reference by ID later */}
        <defs>
          {/* Gradient for the merged area — fades from solid purple to transparent */}
          <linearGradient id="mergedGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"   stopColor="#534AB7" stopOpacity={0.3} />
            <stop offset="95%"  stopColor="#534AB7" stopOpacity={0.02} />
          </linearGradient>

          {/* Gradient for the opened area — fades from teal to transparent */}
          <linearGradient id="openedGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"   stopColor="#1D9E75" stopOpacity={0.2} />
            <stop offset="95%"  stopColor="#1D9E75" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* ── Grid ─────────────────────────────────────────────────────── */}
        {/* Light dashed grid lines to help read values */}
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#E5E7EB"
          vertical={false}  // only horizontal gridlines — cleaner look
        />

        {/* ── X Axis (weeks) ───────────────────────────────────────────── */}
        <XAxis
          dataKey="weekLabel"    // which field from our data to use as labels
          tick={{ fontSize: 11, fill: '#6B7280' }}
          tickLine={false}       // hide the small tick marks
          axisLine={{ stroke: '#E5E7EB' }}
          // Show fewer labels if there are many weeks — avoids crowding
          interval={data.points.length > 12 ? 'preserveStartEnd' : 0}
        />

        {/* ── Y Axis (PR count) ─────────────────────────────────────────── */}
        <YAxis
          tick={{ fontSize: 11, fill: '#6B7280' }}
          tickLine={false}
          axisLine={false}        // hide the vertical axis line — cleaner
          allowDecimals={false}   // PR counts are whole numbers
          width={30}              // reserve space for labels
        />

        {/* ── Tooltip ───────────────────────────────────────────────────── */}
        <Tooltip content={<CustomTooltip />} />

        {/* ── Legend ───────────────────────────────────────────────────── */}
        {/* Shows colour swatches with labels below the chart */}
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value) => value === 'merged' ? 'Merged PRs' : 'Opened PRs'}
          wrapperStyle={{ fontSize: '12px', color: '#6B7280' }}
        />

        {/* ── Opened area (drawn first = behind merged area) ───────────── */}
        {/* This is the background area — opened PRs in teal */}
        <Area
          type="monotone"            // smooth curved line
          dataKey="opened"           // which field from our data
          stroke="#1D9E75"
          strokeWidth={1.5}
          fill="url(#openedGradient)" // reference the gradient by ID
          strokeDasharray="4 2"       // dashed line for opened PRs
        />

        {/* ── Merged area (drawn second = in front) ────────────────────── */}
        {/* This is the main area — merged PRs in purple */}
        <Area
          type="monotone"
          dataKey="merged"
          stroke="#534AB7"
          strokeWidth={2}
          fill="url(#mergedGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}