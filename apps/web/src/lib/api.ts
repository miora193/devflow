// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS THIS FILE?
// This file creates ONE configured axios instance that the entire app uses.
//
// WHY ONE INSTANCE?
// Without this, every component that needs data would write:
//   axios.get('http://localhost:4000/auth/me', { withCredentials: true })
// That is repetitive and error-prone — if the URL changes, you update it
// in 20 places. With this file, you update it in ONE place.
//
// Every API call in our app does:
//   import api from '@/lib/api'
//   api.get('/auth/me')   ← base URL and credentials handled automatically
// ─────────────────────────────────────────────────────────────────────────────

import axios from 'axios'

// Create a pre-configured axios instance.
// All settings defined here apply to EVERY request made with this instance.
const api = axios.create({
  // baseURL is prepended to every request URL.
  // api.get('/auth/me') becomes a request to http://localhost:4000/auth/me
  // In production this would be https://api.yourdomain.com
  // import.meta.env.VITE_API_URL reads from the VITE_API_URL environment variable
  // we set in docker-compose.yml. Falls back to localhost:4000 if not set.
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000',

  // withCredentials: true is CRITICAL for cookies to work.
  // Normally browsers do not send cookies to a different origin (localhost:5173
  // calling localhost:4000). This setting tells the browser:
  // "yes, send the auth_token cookie with every request to this API."
  // Without this, the user would appear logged out on every API call.
  withCredentials: true,
})

// ── Response Interceptor ──────────────────────────────────────────────────────
// An interceptor runs on EVERY response before it reaches your component.
// Think of it as a security guard that checks every delivery.
//
// We use it to handle 401 (Unauthorized) responses globally.
// Without this, every component would need to check "did I get a 401?"
// and redirect to login manually. With this, it happens automatically.
api.interceptors.response.use(
  // First function: runs when the request SUCCEEDS (status 200-299)
  // We just pass the response through unchanged.
  (response) => response,

  // Second function: runs when the request FAILS (status 400+)
  (error) => {
    // If the server says 401 (not authenticated), the session expired
    // or was never set. Redirect to login page automatically.
    if (error.response?.status === 401) {
      // Only redirect if we are not already on the login page.
      // Without this check, the login page itself could trigger a redirect loop.
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }

    // Re-throw the error so individual components can still handle it
    // if they want to show a specific error message.
    return Promise.reject(error)
  }
)

export default api