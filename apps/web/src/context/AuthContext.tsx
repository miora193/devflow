// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS THIS FILE?
// This file creates a "context" — a way to share data with every component
// in the app without passing it down manually through props.
//
// THE PROBLEM IT SOLVES:
// The logged-in user's data is needed everywhere — the sidebar shows their
// avatar, the dashboard shows their workspaces, the header shows their name.
// Without context, you would pass the user as a prop through every component:
//   App → Layout → Sidebar → Avatar (finally gets the user)
// This is called "prop drilling" and it gets messy fast.
//
// WITH CONTEXT:
// Any component can call useAuth() and get the user instantly,
// no matter how deeply nested it is.
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { AuthUser } from '@devflow/types'

// ── Define what the context provides ─────────────────────────────────────────
// This interface describes exactly what every component gets when they
// call useAuth(). TypeScript enforces that we provide all of these.
interface AuthContextType {
  user: AuthUser | null       // the logged-in user, or null if not logged in
  isLoading: boolean          // true while we are checking if the user is logged in
  isAuthenticated: boolean    // true once we know the user is logged in
  logout: () => void          // function to call when user clicks "Log out"
}

// ── Create the context ────────────────────────────────────────────────────────
// createContext creates the context with default values.
// These defaults only apply if a component uses useAuth() outside of
// AuthProvider — which should never happen, but TypeScript needs defaults.
const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  logout: () => {},
})

// ── AuthProvider component ────────────────────────────────────────────────────
// This component wraps the entire app (in main.tsx).
// It fetches the current user once and makes the result available everywhere.
// children is everything inside <AuthProvider>...</AuthProvider>
export function AuthProvider({ children }: { children: ReactNode }) {

  // queryClient lets us manually update the React Query cache.
  // We use it in logout to clear the cached user.
  const queryClient = useQueryClient()

  // useQuery fetches data and caches it.
  // queryKey: ['auth-user'] is the cache key — a unique name for this data.
  // If two components both call useQuery with the same key, they share
  // the same cached result — no duplicate API calls.
  const { data: user, isLoading } = useQuery({
    queryKey: ['auth-user'],

    queryFn: async () => {
      // Call our /auth/me endpoint.
      // The browser automatically sends the auth_token cookie.
      // If the cookie is valid, the server returns the user object.
      // If not, it returns 401, which our interceptor catches.
      const response = await api.get<AuthUser>('/auth/me')
      return response.data
    },

    // retry: false means if this request fails (401 = not logged in),
    // do not try again. We already know they are not logged in.
    retry: false,

    // staleTime: how long to treat the cached data as "fresh".
    // 5 minutes means React Query will not re-fetch /auth/me for 5 minutes
    // unless we explicitly tell it to.
    staleTime: 5 * 60 * 1000,
  })

  // useMutation is for operations that CHANGE data (POST, PUT, DELETE).
  // Logout changes state (removes the cookie), so it is a mutation.
  const logoutMutation = useMutation({
    mutationFn: () => api.post('/auth/logout'),

    onSuccess: () => {
      // Remove the cached user from React Query.
      // Setting to null immediately marks the user as logged out
      // without waiting for a re-fetch.
      queryClient.setQueryData(['auth-user'], null)

      // Redirect to the login page
      window.location.href = '/login'
    },

    onError: (error) => {
      console.error('Logout failed:', error)
      // Even if the API call fails, clear local state and redirect.
      // A failed logout should never keep someone "logged in" on the frontend.
      queryClient.setQueryData(['auth-user'], null)
      window.location.href = '/login'
    }
  })

  return (
    // AuthContext.Provider makes the value available to all children.
    // Any component inside this Provider can call useAuth() to access it.
    <AuthContext.Provider
      value={{
        user: user ?? null,           // undefined becomes null
        isLoading,
        isAuthenticated: !!user,      // !! converts truthy/falsy to true/false
        logout: () => logoutMutation.mutate(),
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ── useAuth hook ──────────────────────────────────────────────────────────────
// This is the hook every component uses to access auth state.
// Usage in any component:
//   const { user, isAuthenticated, logout } = useAuth()
//
// useContext reads the current value from the nearest AuthContext.Provider
// above it in the component tree.
export const useAuth = () => useContext(AuthContext)