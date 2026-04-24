// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS THIS FILE?
// A GitHub-style calendar heatmap showing PR activity for the last 365 days.
// Each square = one day. Darker = more PRs opened that day.
//
// Built with D3 because this requires custom grid layout calculation.
// Recharts cannot do this layout natively.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useEffect, useState } from 'react'
import * as d3 from 'd3'
import { getDay, getWeek, parseISO, format } from 'date-fns'
import type { HeatmapData, HeatmapDay } from '@devflow/types'

// ── Props ─────────────────────────────────────────────────────────────────────
interface ActivityHeatmapProps {
  data: HeatmapData
}

// ── Colour scale ──────────────────────────────────────────────────────────────
// Five colours from lightest (no activity) to darkest (most activity).
// These map to intensity levels 0-4 from the API.
const INTENSITY_COLOURS = [
  '#EEEDFE', // 0 — no activity — very light purple (matches our theme)
  '#C4C1F7', // 1 — low
  '#9A95F0', // 2 — medium
  '#6F68E8', // 3 — high
  '#534AB7', // 4 — very high — our main brand purple
]

// Size of each square cell in pixels
const CELL_SIZE = 13
// Gap between cells
const CELL_GAP  = 3
// Combined step size (cell + gap)
const STEP      = CELL_SIZE + CELL_GAP

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function ActivityHeatmap({ data }: ActivityHeatmapProps) {

  // ── Tooltip state ─────────────────────────────────────────────────────────
  const [tooltip, setTooltip] = useState<{
    x:   number
    y:   number
    day: HeatmapDay
  } | null>(null)

  // ── SVG ref ───────────────────────────────────────────────────────────────
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || data.days.length === 0) return

    // Clear previous render
    d3.select(svgRef.current).selectAll('*').remove()

    const days = data.days

    // ── Calculate grid dimensions ────────────────────────────────────────
    // How many weeks do we have? Each week = one column.
    // 365 days ÷ 7 = ~52 weeks + 1 partial week = 53 columns max.
    //
    // getWeek from date-fns returns the ISO week number (1-53).
    // We normalise week numbers relative to the first day in our data.

    const firstDay  = parseISO(days[0].date)
    const firstWeek = getWeek(firstDay, { weekStartsOn: 1 })

    // totalWeeks: number of columns in the grid
    // We add +2 for padding on both sides
    const totalWeeks = 54

    // SVG dimensions
    const svgWidth  = totalWeeks * STEP + 40  // extra space for day labels
    const svgHeight = 7 * STEP + 30           // 7 rows + space for month labels

    // Create the root SVG group with left margin for day labels
    const svg = d3
      .select(svgRef.current)
      .attr('width',  svgWidth)
      .attr('height', svgHeight)
      .append('g')
      .attr('transform', 'translate(32, 20)') // 32px left for day labels, 20px top for month labels

    // ── Draw day-of-week labels (Mon, Wed, Fri) ──────────────────────────
    // We only show Mon, Wed, Fri to avoid crowding.
    const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', '']
    dayLabels.forEach((label, i) => {
      if (!label) return
      svg.append('text')
        .attr('x', -6)                    // just to the left of the grid
        .attr('y', i * STEP + CELL_SIZE)  // vertically aligned with row i
        .attr('text-anchor', 'end')
        .attr('fill', '#9CA3AF')
        .attr('font-size', 10)
        .text(label)
    })

    // ── Draw month labels ────────────────────────────────────────────────
    // We show the month name above the first week of each month.
    // We track which months we have already labelled to avoid duplicates.
    const labelledMonths = new Set<string>()

    days.forEach(day => {
      const date       = parseISO(day.date)
      const monthLabel = format(date, 'MMM') // "Jan", "Feb" etc.

      // Only label the first occurrence of each month
      if (date.getDate() <= 7 && !labelledMonths.has(monthLabel)) {
        labelledMonths.add(monthLabel)

        // Calculate which week column this day belongs to
        const weekNum   = getWeek(date, { weekStartsOn: 1 })
        // Normalise to 0-based relative to first week
        const weekIndex = ((weekNum - firstWeek + 53) % 53)

        svg.append('text')
          .attr('x', weekIndex * STEP)
          .attr('y', -6) // above the grid
          .attr('fill', '#9CA3AF')
          .attr('font-size', 10)
          .text(monthLabel)
      }
    })

    // ── Draw the cells ───────────────────────────────────────────────────
    // Each day becomes one rect (square) element.
    svg.selectAll('.day-cell')
      .data(days)
      .enter()
      .append('rect')
      .attr('class', 'day-cell')
      .attr('width',  CELL_SIZE)
      .attr('height', CELL_SIZE)
      .attr('rx', 2)  // slightly rounded corners — matches GitHub style
      .attr('ry', 2)
      .attr('x', day => {
        // Column = which week this day falls in, relative to the first day
        const date      = parseISO(day.date)
        const weekNum   = getWeek(date, { weekStartsOn: 1 })
        const weekIndex = ((weekNum - firstWeek + 53) % 53)
        return weekIndex * STEP
      })
      .attr('y', day => {
        // Row = day of week (0=Sun, 1=Mon ... 6=Sat in JS)
        // We use getDay and remap so Monday=0 (top row)
        const date        = parseISO(day.date)
        const dayOfWeek   = getDay(date)    // 0=Sun, 1=Mon...6=Sat
        // Remap: Mon=0, Tue=1, ... Sun=6
        const rowIndex    = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        return rowIndex * STEP
      })
      // Fill colour based on intensity level
      .attr('fill', day => INTENSITY_COLOURS[day.intensity])
      // Slightly darker border to separate cells
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .style('cursor', day => day.count > 0 ? 'pointer' : 'default')

      // ── Hover interactions ─────────────────────────────────────────────
      .on('mouseenter', function(event, day) {
        // Only show tooltip if there is activity
        if (day.count === 0) return

        // Make cell slightly brighter on hover
        d3.select(this).attr('opacity', 0.8)

        const svgRect = svgRef.current!.getBoundingClientRect()
        setTooltip({
          x:   event.clientX - svgRect.left,
          y:   event.clientY - svgRect.top,
          day,
        })
      })
      .on('mouseleave', function() {
        d3.select(this).attr('opacity', 1)
        setTooltip(null)
      })

    // ── Draw the colour legend ───────────────────────────────────────────
    // A small row of squares at the bottom right showing the intensity scale.
    const legendX     = (totalWeeks - 7) * STEP   // right-aligned
    const legendY     = 7 * STEP + 8              // below the grid

    // "Less" label
    svg.append('text')
      .attr('x', legendX - 4)
      .attr('y', legendY + CELL_SIZE)
      .attr('text-anchor', 'end')
      .attr('fill', '#9CA3AF')
      .attr('font-size', 10)
      .text('Less')

    // Five intensity squares
    INTENSITY_COLOURS.forEach((colour, i) => {
      svg.append('rect')
        .attr('x',      legendX + i * (CELL_SIZE + 2))
        .attr('y',      legendY)
        .attr('width',  CELL_SIZE)
        .attr('height', CELL_SIZE)
        .attr('rx', 2)
        .attr('fill',   colour)
        .attr('stroke', '#fff')
        .attr('stroke-width', 1)
    })

    // "More" label
    svg.append('text')
      .attr('x', legendX + 5 * (CELL_SIZE + 2) + 4)
      .attr('y', legendY + CELL_SIZE)
      .attr('fill', '#9CA3AF')
      .attr('font-size', 10)
      .text('More')

  }, [data])

  // ── Empty state ───────────────────────────────────────────────────────────
  if (data.days.length === 0) {
    return (
      <div style={{
        height:         '140px',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        color:          'var(--color-text-secondary)',
        fontSize:       '14px',
        border:         '1px dashed var(--color-border)',
        borderRadius:   '8px',
      }}>
        No activity data found
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', overflowX: 'auto' }}>

      {/* overflowX: auto allows horizontal scrolling on small screens */}
      <svg ref={svgRef} />

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position:      'absolute',
          left:          tooltip.x + 12,
          top:           tooltip.y - 40,
          background:    'var(--color-bg)',
          border:        '1px solid var(--color-border)',
          borderRadius:  '8px',
          padding:       '8px 12px',
          fontSize:      '12px',
          lineHeight:    1.6,
          boxShadow:     '0 4px 12px rgba(0,0,0,0.1)',
          pointerEvents: 'none',
          zIndex:        10,
          whiteSpace:    'nowrap',
        }}>
          <strong>
            {/* Format: "Monday, Jan 15 2026" */}
            {format(parseISO(tooltip.day.date), 'EEEE, MMM d yyyy')}
          </strong>
          <br />
          <span style={{ color: 'var(--color-text-secondary)' }}>
            {tooltip.day.count} PR{tooltip.day.count !== 1 ? 's' : ''} opened
          </span>
        </div>
      )}
    </div>
  )
}