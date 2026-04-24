// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS THIS FILE?
// Custom React Query hooks for all analytics data.
//
// Each hook fetches data for one specific chart:
//   useCycleTime    → scatter plot data
//   useVelocity     → area chart data
//   useReviewDepth  → bar chart data
//   useHeatmap      → calendar heatmap data
//
// All hooks accept:
//   repoId: string   — which repository to fetch analytics for
//   days?: number    — how many days back to look (default 90)
//
// WHY CENTRALISE HERE?
// Chart components should only care about rendering, not fetching.
// Keeping all fetching logic here means components stay clean and
// the data layer is easy to find and modify.
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type {
  CycleTimeData,
  VelocityData,
  ReviewDepthData,
  HeatmapData,
} from '@devflow/types'


// ── useCycleTime ──────────────────────────────────────────────────────────────
// Fetches cycle time data for the scatter plot.
// Returns: one data point per merged PR.
export function useCycleTime(repoId: string, days = 90) {
  return useQuery({
    // queryKey includes repoId and days so each unique combination
    // is cached separately. Changing days triggers a fresh fetch.
    queryKey: ['analytics', 'cycle-time', repoId, days],

    queryFn: async () => {
      const res = await api.get<CycleTimeData>(
        `/analytics/${repoId}/cycle-time?days=${days}`
      )
      return res.data
    },

    // Only fetch if we have a repoId — avoids unnecessary calls
    enabled: !!repoId,

    // Analytics data changes infrequently — cache for 5 minutes
    // before re-fetching in the background
    staleTime: 5 * 60 * 1000,
  })
}


// ── useVelocity ───────────────────────────────────────────────────────────────
// Fetches velocity data for the area chart.
// Returns: one data point per week showing merged/opened counts.
export function useVelocity(repoId: string, days = 90) {
  return useQuery({
    queryKey: ['analytics', 'velocity', repoId, days],

    queryFn: async () => {
      const res = await api.get<VelocityData>(
        `/analytics/${repoId}/velocity?days=${days}`
      )
      return res.data
    },

    enabled:   !!repoId,
    staleTime: 5 * 60 * 1000,
  })
}


// ── useReviewDepth ────────────────────────────────────────────────────────────
// Fetches review depth data for the bar chart.
// Returns: one data point per author showing review thoroughness.
export function useReviewDepth(repoId: string, days = 90) {
  return useQuery({
    queryKey: ['analytics', 'review-depth', repoId, days],

    queryFn: async () => {
      const res = await api.get<ReviewDepthData>(
        `/analytics/${repoId}/review-depth?days=${days}`
      )
      return res.data
    },

    enabled:   !!repoId,
    staleTime: 5 * 60 * 1000,
  })
}


// ── useHeatmap ────────────────────────────────────────────────────────────────
// Fetches heatmap data for the calendar chart.
// Always returns 365 days — the days param is ignored here
// because the heatmap is always a full year view.
export function useHeatmap(repoId: string) {
  return useQuery({
    queryKey: ['analytics', 'heatmap', repoId],

    queryFn: async () => {
      const res = await api.get<HeatmapData>(
        `/analytics/${repoId}/heatmap`
      )
      return res.data
    },

    enabled:   !!repoId,
    // Heatmap data is expensive to compute — cache for 10 minutes
    staleTime: 10 * 60 * 1000,
  })
}


// ── useAnalyticsSummary ───────────────────────────────────────────────────────
// A convenience hook that fetches ALL analytics data at once.
// Used by the analytics dashboard header to show key numbers.
// Returns loading/error state combined across all four queries.
export function useAnalyticsSummary(repoId: string, days = 90) {
  const cycleTime   = useCycleTime(repoId, days)
  const velocity    = useVelocity(repoId, days)
  const reviewDepth = useReviewDepth(repoId, days)
  const heatmap     = useHeatmap(repoId)

  return {
    cycleTime,
    velocity,
    reviewDepth,
    heatmap,

    // isLoading is true if ANY of the four queries are still loading
    isLoading: cycleTime.isLoading || velocity.isLoading ||
               reviewDepth.isLoading || heatmap.isLoading,

    // isError is true if ANY of the four queries failed
    isError: cycleTime.isError || velocity.isError ||
             reviewDepth.isError || heatmap.isError,
  }
}