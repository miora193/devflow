// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS THIS FILE?
// A grouped bar chart comparing PR review thoroughness per author.
// Each author gets 3 bars: avg comments, avg reviews, avg changes requested.
//
// Built with Recharts BarChart — grouped bar charts are its strength.
// ─────────────────────────────────────────────────────────────────────────────

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { ReviewDepthData } from '@devflow/types'

// ── Props ─────────────────────────────────────────────────────────────────────
interface ReviewDepthChartProps {
  data:    ReviewDepthData
  height?: number
}

// ── Colours for the three bar types ──────────────────────────────────────────
const COLOURS = {
  avgComments:         '#534AB7', // purple — comments
  avgReviews:          '#1D9E75', // teal — formal reviews
  avgChangesRequested: '#F59E0B', // amber — changes requested
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
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
      minWidth:     '180px',
    }}>
      {/* Author username */}
      <p style={{ fontWeight: 500, marginBottom: '6px', fontSize: '13px' }}>
        @{label}
      </p>

      {payload.map((entry: any) => {
        // Map the dataKey to a readable label
        const labels: Record<string, string> = {
          avgComments:         'Avg comments / PR',
          avgReviews:          'Avg reviews / PR',
          avgChangesRequested: 'Avg changes requested / PR',
        }
        return (
          <p key={entry.dataKey} style={{ color: entry.fill, margin: 0 }}>
            {labels[entry.dataKey]}: <strong style={{ color: 'var(--color-text-primary)' }}>
              {entry.value}
            </strong>
          </p>
        )
      })}

      {/* Also show total PRs from the data — useful context */}
      {payload[0]?.payload && (
        <p style={{ color: 'var(--color-text-secondary)', marginTop: '4px', borderTop: '1px solid var(--color-border)', paddingTop: '4px' }}>
          Total PRs: {payload[0].payload.totalPRs}
        </p>
      )}
    </div>
  )
}

// ── Custom X axis tick ────────────────────────────────────────────────────────
// Recharts renders X axis labels as SVG text elements.
// We use a custom component to truncate long usernames gracefully.
function CustomXAxisTick({ x, y, payload }: any) {
  const username = payload.value as string
  // Truncate usernames longer than 10 chars
  const display  = username.length > 10 ? username.slice(0, 10) + '…' : username

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={12}                // offset down from the axis line
        textAnchor="middle"
        fill="#6B7280"
        fontSize={11}
      >
        {display}
      </text>
    </g>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function ReviewDepthChart({ data, height = 320 }: ReviewDepthChartProps) {

  // ── Empty state ───────────────────────────────────────────────────────────
  if (data.authors.length === 0) {
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
        No review data found in this time range
      </div>
    )
  }

  // ── Highlight logic ───────────────────────────────────────────────────────
  // We highlight the author with the highest average comments
  // to draw attention to the most-reviewed contributor.
  const maxComments = Math.max(...data.authors.map(a => a.avgComments))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data.authors}
        // barCategoryGap controls space between each author group
        // barGap controls space between bars within a group
        barCategoryGap="25%"
        barGap={2}
        margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
      >
        {/* ── Grid ─────────────────────────────────────────────────────── */}
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#E5E7EB"
          vertical={false}
        />

        {/* ── X Axis (authors) ─────────────────────────────────────────── */}
        <XAxis
          dataKey="authorUsername"
          tick={<CustomXAxisTick />}
          tickLine={false}
          axisLine={{ stroke: '#E5E7EB' }}
          // interval=0 means show every author label — do not skip any
          interval={0}
        />

        {/* ── Y Axis (average count) ───────────────────────────────────── */}
        <YAxis
          tick={{ fontSize: 11, fill: '#6B7280' }}
          tickLine={false}
          axisLine={false}
          allowDecimals={true}
          width={35}
          // Label on the axis
          label={{
            value:    'Average per PR',
            angle:    -90,
            position: 'insideLeft',
            offset:   10,
            style:    { fontSize: 11, fill: '#9CA3AF' },
          }}
        />

        {/* ── Tooltip ───────────────────────────────────────────────────── */}
        <Tooltip
          content={<CustomTooltip />}
          // cursor is the hover highlight behind the bars
          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
        />

        {/* ── Legend ───────────────────────────────────────────────────── */}
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value) => {
            const labels: Record<string, string> = {
              avgComments:         'Comments',
              avgReviews:          'Reviews',
              avgChangesRequested: 'Changes requested',
            }
            return labels[value] || value
          }}
          wrapperStyle={{ fontSize: '12px', color: '#6B7280', paddingTop: '8px' }}
        />

        {/* ── Bar 1: Average comments ──────────────────────────────────── */}
        {/* We use Cell to highlight the author with the most comments */}
        <Bar
          dataKey="avgComments"
          fill={COLOURS.avgComments}
          radius={[3, 3, 0, 0]}  // rounded top corners
          maxBarSize={28}
        >
          {data.authors.map((entry) => (
            <Cell
              key={entry.authorUsername}
              // Highlight the top commenter with full opacity
              // others slightly transparent
              fillOpacity={entry.avgComments === maxComments ? 1 : 0.7}
            />
          ))}
        </Bar>

        {/* ── Bar 2: Average formal reviews ────────────────────────────── */}
        <Bar
          dataKey="avgReviews"
          fill={COLOURS.avgReviews}
          radius={[3, 3, 0, 0]}
          maxBarSize={28}
          fillOpacity={0.8}
        />

        {/* ── Bar 3: Average changes requested ─────────────────────────── */}
        {/* High changes requested = PR needed lots of back-and-forth */}
        <Bar
          dataKey="avgChangesRequested"
          fill={COLOURS.avgChangesRequested}
          radius={[3, 3, 0, 0]}
          maxBarSize={28}
          fillOpacity={0.8}
        />

      </BarChart>
    </ResponsiveContainer>
  )
}