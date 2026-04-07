// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS THIS FILE?
// The login page — the first thing unauthenticated users see.
// It has one job: show a "Continue with GitHub" button.
//
// When clicked, the button sends the user to our API's /auth/github endpoint,
// which redirects them to GitHub, which redirects back to /auth/github/callback,
// which creates the JWT cookie and redirects to /dashboard.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export default function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()

  // useSearchParams reads query parameters from the URL.
  // After a failed OAuth attempt, the API redirects to /login?error=oauth_failed
  // We read that error here and show a message.
  const [searchParams] = useSearchParams()
  const error = searchParams.get('error')

  // If the user is already logged in and somehow landed on /login,
  // redirect them to the dashboard automatically.
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, isLoading, navigate])

  // Map error codes to human-readable messages
  const errorMessages: Record<string, string> = {
    oauth_failed:          'Login failed. Please try again.',
    no_code:               'GitHub did not send an authorisation code. Please try again.',
    token_exchange_failed: 'Could not exchange code for token. Please try again.',
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontFamily: 'var(--font-sans)',
      background: 'var(--color-bg)',
      padding: '24px',
    }}>

      {/* Logo / App name */}
      <div style={{ marginBottom: '48px', textAlign: 'center' }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          margin: 0,
          letterSpacing: '-0.5px',
        }}>
          DevFlow
        </h1>
        <p style={{
          color: 'var(--color-text-secondary)',
          marginTop: '8px',
          fontSize: '16px',
        }}>
          PR analytics and team insights
        </p>
      </div>

      {/* Login card */}
      <div style={{
        width: '100%',
        maxWidth: '380px',
        border: `1px solid var(--color-border)`,
        borderRadius: 'var(--radius-lg)',
        padding: '32px',
        background: 'var(--color-bg)',
      }}>
        <h2 style={{
          fontSize: '20px',
          fontWeight: 600,
          margin: '0 0 8px',
          color: 'var(--color-text-primary)',
        }}>
          Welcome back
        </h2>
        <p style={{
          fontSize: '14px',
          color: 'var(--color-text-secondary)',
          margin: '0 0 24px',
          lineHeight: 1.5,
        }}>
          Sign in with your GitHub account to access your dashboard.
        </p>

        {/* Error message — only shown if there is an error in the URL */}
        {error && (
          <div style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
            marginBottom: '20px',
            fontSize: '13px',
            color: '#DC2626',
          }}>
            {errorMessages[error] || 'An error occurred. Please try again.'}
          </div>
        )}

        {/* GitHub login button — this is a regular <a> link, not a React Router link.
            It goes to our API server (port 4000), not to a React route.
            The API then redirects to GitHub. */}
        
          <a href="http://localhost:4000/auth/github"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            width: '100%',
            padding: '12px 20px',
            background: '#24292f',
            color: '#ffffff',
            borderRadius: 'var(--radius-md)',
            fontSize: '15px',
            fontWeight: 500,
            textDecoration: 'none',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLAnchorElement).style.background = '#32383f'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLAnchorElement).style.background = '#24292f'
          }}
        >
          {/* GitHub logo SVG */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
          </svg>
          Continue with GitHub
        </a>
      </div>

      {/* Footer note */}
      <p style={{
        marginTop: '32px',
        fontSize: '12px',
        color: 'var(--color-text-muted)',
        textAlign: 'center',
      }}>
        By signing in you agree to our terms of service.
      </p>
    </div>
  )
}