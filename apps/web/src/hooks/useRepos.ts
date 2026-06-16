// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS THIS FILE?
// Custom React Query hooks for fetching repository and pull request data.
//
// WHY CUSTOM HOOKS?
// Instead of writing the same useQuery call in every component that needs
// repos or PRs, we write it once here and any component can import it.
//
// A custom hook is just a function that starts with "use" and calls
// other hooks inside it. React treats it the same as a built-in hook.
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────
// These describe the shape of data coming from our API.
// We define them here instead of importing from @devflow/types because
// the API response includes extra fields like _count.

export interface Repo {
  id:            string
  fullName:      string
  name:          string
  owner:         string
  isPrivate:     boolean
  defaultBranch: string
  lastSyncedAt:  string | null
  createdAt:     string
  // _count is added by Prisma when we use include: { _count: ... }
  // It gives us the number of PRs without fetching all of them
  _count: {
    pullRequests: number
  }
}

export interface PullRequest {
  id:              string
  githubNumber:    number
  title:           string
  state:           'open' | 'closed' | 'merged'
  authorUsername:  string
  authorAvatarUrl: string
  baseBranch:      string
  headBranch:      string
  githubUrl:       string
  commentsCount:   number
  reviewsCount:    number
  changedFiles:    number
  additions:       number
  deletions:       number
  githubCreatedAt: string
  githubUpdatedAt: string
  githubMergedAt:  string | null
  githubClosedAt:  string | null
}

export interface PullRequestsResponse {
  pullRequests: PullRequest[]
  pagination: {
    page:       number
    limit:      number
    total:      number
    totalPages: number
    hasMore:    boolean
  }
}


// ── useRepos ──────────────────────────────────────────────────────────────────
// Fetches all repositories connected to the user's workspace.
// Used on the Repositories page to show the list of connected repos.
export function useRepos() {
  return useQuery({
    // queryKey is the cache key — React Query uses this to store and retrieve data
    // ['repos'] means "cache this under the key 'repos'"
    queryKey: ['repos'],

    queryFn: async () => {
      const response = await api.get<Repo[]>('/repos')
      return response.data
    },

    // staleTime: treat the data as fresh for 30 seconds
    // After 30 seconds, React Query re-fetches in the background
    staleTime: 30 * 1000,
  })
}


// ── useConnectRepo ────────────────────────────────────────────────────────────
// Mutation for connecting a new repository.
// useMutation is for operations that CHANGE data (POST, PUT, DELETE).
export function useConnectRepo() {
  // queryClient lets us manually update the cache after a mutation
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (fullName: string) => {
      const response = await api.post('/repos/connect', { fullName })
      return response.data
    },

    onSuccess: () => {
      // After connecting a repo, invalidate the repos cache
      // This forces React Query to re-fetch the repos list
      // so the new repo appears immediately
      queryClient.invalidateQueries({ queryKey: ['repos'] })
    },
  })
}


// ── useSyncRepo ───────────────────────────────────────────────────────────────
// Mutation for triggering a manual sync on a repository.
export function useSyncRepo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (repoId: string) => {
      const response = await api.post(`/repos/${repoId}/sync`)
      return response.data
    },

    onSuccess: (_data, repoId) => {
      // Invalidate the PRs for this repo so they re-fetch after sync
      queryClient.invalidateQueries({ queryKey: ['pulls', repoId] })
    },
  })
}


// ── usePullRequests ───────────────────────────────────────────────────────────
// Fetches pull requests for a specific repository with filtering.
// repoId: our internal repository ID
// state: optional filter — 'open', 'closed', 'merged', or undefined for all
// page: which page of results to fetch
export function usePullRequests(repoId: string, state?: string, page = 1) {
  return useQuery({
    // Include repoId, state, and page in the key
    // So ['pulls', 'abc123', 'open', 1] and ['pulls', 'abc123', 'closed', 1]
    // are cached separately — changing the filter does not use stale data
    queryKey: ['pulls', repoId, state, page],

    queryFn: async () => {
      // Build query params
      const params = new URLSearchParams()
      params.set('page',  String(page))
      params.set('limit', '20')
      if (state) params.set('state', state)

      const response = await api.get<PullRequestsResponse>(
        `/repos/${repoId}/pulls?${params}`
      )
      return response.data
    },

    // Only fetch if we have a repoId
    // enabled: false means "do not fetch yet"
    enabled: !!repoId,

    staleTime: 30 * 1000,
  })
}