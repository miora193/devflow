// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS THIS FILE?
// A scatter plot showing PR cycle times over time.
// Each dot is one merged PR.
// X axis = when the PR was opened.
// Y axis = how many days it took to merge.
//
// Built with D3 because we need a custom trend line and per-author colours.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useEffect, useState } from 'react'
import * as d3 from 'd3'
import type { CycleTimeData, CycleTimePoint } from '@devflow/types'

// ── Props ─────────────────────────────────────────────────────────────────────
interface CycleTimeChartProps {
  // The full data object returned by the API
  data: CycleTimeData

  // Chart dimensions — parent decides how big the chart is
  width?:  number
  height?: number
}

// ── Colour palette for authors ────────────────────────────────────────────────
// Each unique author gets a consistent colour.
// We use D3's built-in colour scheme — 10 distinct colours.
const COLOUR_SCALE = d3.scaleOrdinal(d3.schemeTableau10)

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function CycleTimeChart({
  data,
  width  = 700,
  height = 380,
}: CycleTimeChartProps) {

  // ── Tooltip state ─────────────────────────────────────────────────────────
  // When the user hovers over a dot, we show a tooltip with PR details.
  // null = no tooltip showing
  const [tooltip, setTooltip] = useState<{
    x:     number
    y:     number
    point: CycleTimePoint
  } | null>(null)

  // ── SVG ref ───────────────────────────────────────────────────────────────
  // React ref gives us direct access to the SVG DOM element.
  // D3 needs direct DOM access to render into it.
  const svgRef = useRef<SVGSVGElement>(null)

  // ── Chart margins ─────────────────────────────────────────────────────────
  // Margins create space for axis labels around the chart area.
  // The actual plotting area is smaller than the full SVG.
  const margin = { top: 20, right: 20, bottom: 50, left: 60 }

  // The inner dimensions — where dots are actually drawn
  const innerWidth  = width  - margin.left - margin.right
  const innerHeight = height - margin.top  - margin.bottom

  // ── Draw the chart with D3 ────────────────────────────────────────────────
  // useEffect runs after React renders the SVG element to the DOM.
  // We use D3 to draw inside that SVG element.
  useEffect(() => {
    // If no SVG element or no data, do nothing
    if (!svgRef.current || data.points.length === 0) return

    // ── Step 1: Clear previous chart ────────────────────────────────────────
    // Every time data changes, we clear and redraw from scratch.
    // This is the simplest approach — for large datasets we would use
    // D3 transitions and update patterns instead.
    d3.select(svgRef.current).selectAll('*').remove()

    const points = data.points

    // ── Step 2: Create the root group ───────────────────────────────────────
    // We translate (move) the group by the margin so we do not have to
    // account for margins in every individual element position.
    const svg = d3
      .select(svgRef.current)
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`)

    // ── Step 3: Create X scale (time) ───────────────────────────────────────
    // scaleTime() maps Date objects to pixel positions.
    // domain = [earliest date, latest date] in our data
    // range  = [0, innerWidth] in pixels
    const xScale = d3.scaleTime()
      .domain(d3.extent(points, p => new Date(p.openedAt)) as [Date, Date])
      .range([0, innerWidth])
      // .nice() rounds the domain to nice values (start/end of month)
      .nice()

    // ── Step 4: Create Y scale (cycle time in days) ──────────────────────────
    // scaleLinear() maps numbers to pixel positions.
    // domain = [0, max cycle time + 10% padding]
    // range  = [innerHeight, 0] — INVERTED because SVG y=0 is at the top
    const maxDays = d3.max(points, p => p.cycleTimeDays) || 1
    const yScale = d3.scaleLinear()
      .domain([0, maxDays * 1.1])
      .range([innerHeight, 0])
      .nice()

    // ── Step 5: Draw gridlines ───────────────────────────────────────────────
    // Horizontal gridlines help the eye trace values across the chart.
    svg.append('g')
      .attr('class', 'gridlines')
      .call(
        d3.axisLeft(yScale)
          .tickSize(-innerWidth)  // negative size draws lines across the chart
          .tickFormat(() => '')   // no labels on gridlines — axis handles that
      )
      .call(g => g.select('.domain').remove()) // remove the axis line itself
      .call(g => g.selectAll('.tick line')
        .attr('stroke', '#E5E7EB') // light gray gridlines
        .attr('stroke-dasharray', '3,3') // dashed lines
      )

    // ── Step 6: Draw X axis ──────────────────────────────────────────────────
    svg.append('g')
      .attr('transform', `translate(0, ${innerHeight})`) // move to bottom
      .call(
        d3.axisBottom(xScale)
          .ticks(6) // show about 6 date labels
          .tickFormat(d => d3.timeFormat('%b %d')(d as Date)) // "Jan 15" format
      )
      .call(g => g.select('.domain').attr('stroke', '#E5E7EB'))
      .call(g => g.selectAll('.tick line').attr('stroke', '#E5E7EB'))
      .call(g => g.selectAll('.tick text')
        .attr('fill', '#6B7280')
        .attr('font-size', '11px')
      )

    // ── Step 7: Draw Y axis ──────────────────────────────────────────────────
    svg.append('g')
      .call(
        d3.axisLeft(yScale)
          .ticks(5)
          .tickFormat(d => `${d}d`) // "5d" format
      )
      .call(g => g.select('.domain').attr('stroke', '#E5E7EB'))
      .call(g => g.selectAll('.tick line').attr('stroke', '#E5E7EB'))
      .call(g => g.selectAll('.tick text')
        .attr('fill', '#6B7280')
        .attr('font-size', '11px')
      )

    // ── Step 8: Draw Y axis label ────────────────────────────────────────────
    svg.append('text')
      .attr('transform', 'rotate(-90)') // rotate 90 degrees counterclockwise
      .attr('y', -45)
      .attr('x', -innerHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', '#6B7280')
      .attr('font-size', '12px')
      .text('Cycle time (days)')

    // ── Step 9: Draw trend line ──────────────────────────────────────────────
    // Linear regression finds the best straight line through all the dots.
    // This shows whether cycle times are trending up or down over time.
    if (points.length > 1) {

      // Convert dates to numbers for the regression calculation
      // D3 regression needs numbers, not Date objects
      const regressionData = points.map(p => [
        new Date(p.openedAt).getTime(), // X: date as milliseconds
        p.cycleTimeDays,                 // Y: cycle time
      ] as [number, number])

      // Calculate linear regression manually (D3 does not have this built in)
      // y = mx + b   where m = slope, b = y-intercept
      const n   = regressionData.length
      const sumX = regressionData.reduce((s, [x]) => s + x, 0)
      const sumY = regressionData.reduce((s, [, y]) => s + y, 0)
      const sumXY = regressionData.reduce((s, [x, y]) => s + x * y, 0)
      const sumX2 = regressionData.reduce((s, [x]) => s + x * x, 0)

      const slope     = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
      const intercept = (sumY - slope * sumX) / n

      // Get the X domain (earliest and latest dates as numbers)
      const xDomain = xScale.domain().map(d => d.getTime())

      // Calculate the Y values at the start and end of the trend line
      const trendY1 = slope * xDomain[0] + intercept
      const trendY2 = slope * xDomain[1] + intercept

      // Draw the trend line
      svg.append('line')
        .attr('x1', xScale(new Date(xDomain[0])))
        .attr('y1', yScale(Math.max(0, trendY1))) // clamp to 0 minimum
        .attr('x2', xScale(new Date(xDomain[1])))
        .attr('y2', yScale(Math.max(0, trendY2)))
        .attr('stroke', slope > 0 ? '#EF4444' : '#10B981') // red = getting worse, green = improving
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '6,3') // dashed trend line
        .attr('opacity', 0.7)
    }

    // ── Step 10: Draw the dots ───────────────────────────────────────────────
    // Each dot is a circle. We use D3's data join pattern:
    // svg.selectAll().data(points).enter().append() creates one element per data point
    svg.selectAll('.dot')
      .data(points)
      .enter()
      .append('circle')
      .attr('class', 'dot')
      // cx = horizontal centre of circle = X scale applied to the opened date
      .attr('cx', p => xScale(new Date(p.openedAt)))
      // cy = vertical centre = Y scale applied to cycle time days
      .attr('cy', p => yScale(p.cycleTimeDays))
      .attr('r', 5) // radius in pixels
      // Each author gets a consistent colour from the colour scale
      .attr('fill', p => COLOUR_SCALE(p.authorUsername))
      .attr('opacity', 0.75)
      .attr('stroke', 'white')
      .attr('stroke-width', 1)
      // ── Hover interactions ───────────────────────────────────────────────
      .style('cursor', 'pointer')
      .on('mouseenter', function(event, p) {
        // Make the dot bigger on hover
        d3.select(this).attr('r', 8).attr('opacity', 1)

        // Show tooltip — position relative to the SVG element
        const svgRect = svgRef.current!.getBoundingClientRect()
        setTooltip({
          x: event.clientX - svgRect.left,
          y: event.clientY - svgRect.top,
          point: p,
        })
      })
      .on('mouseleave', function() {
        // Restore dot size
        d3.select(this).attr('r', 5).attr('opacity', 0.75)
        setTooltip(null)
      })

    // ── Step 11: Draw the legend ─────────────────────────────────────────────
    // Show which colour represents which author.
    const authors = [...new Set(points.map(p => p.authorUsername))]

    // Only show legend if there are multiple authors — one author needs no legend
    if (authors.length > 1) {
      const legend = svg.append('g')
        .attr('transform', `translate(${innerWidth - 120}, 0)`)

      authors.slice(0, 5).forEach((author, i) => { // max 5 authors in legend
        const row = legend.append('g')
          .attr('transform', `translate(0, ${i * 20})`)

        row.append('circle')
          .attr('r', 5)
          .attr('fill', COLOUR_SCALE(author))

        row.append('text')
          .attr('x', 10)
          .attr('y', 4) // vertically centre with circle
          .attr('fill', '#374151')
          .attr('font-size', '11px')
          // Truncate long usernames
          .text(author.length > 12 ? author.slice(0, 12) + '…' : author)
      })
    }

  // Re-run this effect whenever data or dimensions change
  }, [data, width, height, innerWidth, innerHeight])

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
        No merged PRs found in this time range
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative' }}>

      {/* The SVG element D3 draws into */}
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ overflow: 'visible' }}
      />

      {/* Tooltip — shown on dot hover */}
      {tooltip && (
        <div style={{
          position:     'absolute',
          left:         tooltip.x + 12,
          top:          tooltip.y - 10,
          background:   'var(--color-bg)',
          border:       '1px solid var(--color-border)',
          borderRadius: '8px',
          padding:      '10px 12px',
          fontSize:     '12px',
          lineHeight:   1.6,
          boxShadow:    '0 4px 12px rgba(0,0,0,0.1)',
          pointerEvents: 'none', // tooltip should not block mouse events on dots
          zIndex:       10,
          maxWidth:     '220px',
        }}>
          <div style={{ fontWeight: 500, marginBottom: '4px', fontSize: '13px' }}>
            #{tooltip.point.prNumber} — {tooltip.point.title.slice(0, 40)}
            {tooltip.point.title.length > 40 ? '…' : ''}
          </div>
          <div style={{ color: 'var(--color-text-secondary)' }}>
            Author: @{tooltip.point.authorUsername}
          </div>
          <div style={{ color: 'var(--color-text-secondary)' }}>
            Cycle time: <strong style={{ color: 'var(--color-text-primary)' }}>
              {tooltip.point.cycleTimeDays} days
            </strong>
          </div>
          <div style={{ color: 'var(--color-text-secondary)' }}>
            Opened: {new Date(tooltip.point.openedAt).toLocaleDateString()}
          </div>
        </div>
      )}
    </div>
  )
}