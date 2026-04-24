// main.tsx — the entry point of the entire React application
//
// This is the FIRST file React runs. It:
// 1. Finds the <div id="root"> in index.html
// 2. Wraps the whole app in "providers" — tools that every component needs
// 3. Renders the App component into that div
//
// Think of providers like power sockets — you plug them in once here
// and every component in the app can use the power.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// BrowserRouter enables React Router — without this, <Routes> and
// <Route> components would not work
import { BrowserRouter } from 'react-router-dom'

// QueryClient is the brain of React Query — it manages the cache of
// all server data. We create one and share it with the whole app.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// DevTools adds a small panel in development where you can see all
// React Query caches, their status, and when they last fetched.
// It is automatically excluded from production builds.
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { AuthProvider } from '@/context/AuthContext'
import { SocketProvider }    from './context/SocketContext'

import App from './App'

// Import global styles — this applies our CSS reset and variables
import './index.css'

// ── Create the React Query client ─────────────────────────────────────────────
// This object holds all the configuration for how React Query behaves.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // How long (ms) before React Query considers cached data "stale"
      // and re-fetches it in the background. 60 seconds is a good default.
      staleTime: 60 * 1000,

      // If a query fails, how many times should React Query retry before
      // giving up and showing an error? 1 retry is enough for most cases.
      retry: 1,

      // Do NOT re-fetch data just because the user switched browser tabs
      // and came back. This prevents unnecessary API calls.
      refetchOnWindowFocus: false,
    },
  },
})

// ── Find the root DOM element ─────────────────────────────────────────────────
// index.html has a <div id="root"></div>. React renders everything inside it.
const rootElement = document.getElementById('root')

// The "!" tells TypeScript "I promise this element exists — do not worry."
// If it does not exist, the app throws an error immediately which is correct.
if (!rootElement) {
  throw new Error(
    'Root element not found. Make sure index.html has <div id="root"></div>'
  )
}

// ── Render the app ────────────────────────────────────────────────────────────
createRoot(rootElement).render(
  // StrictMode runs your components twice in development to catch bugs.
  // It has zero effect in production. Always keep it on.
  <StrictMode>
    {/* BrowserRouter gives every component access to URL/navigation info */}
    <BrowserRouter>
      {/* QueryClientProvider shares the queryClient with every component */}
      <QueryClientProvider client={queryClient}>

        {/* AuthProvider wraps everything so every component can call useAuth() */}
        <AuthProvider>
          {/* SocketProvider must be inside AuthProvider */}
          {/* because it reads isAuthenticated from useAuth() */}
          <SocketProvider>
            <App />
          </SocketProvider>
          <ReactQueryDevtools initialIsOpen={false} />
        </AuthProvider>

      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>
)