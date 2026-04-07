// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS THIS FILE?
// The dashboard — the first page logged-in users see.
// Right now it just proves the auth flow works end to end:
//   - Shows the user's GitHub avatar and username
//   - Shows a logout button that works
//
// This page will grow significantly in Phase 2 onwards.
// For now it is our proof that the entire auth system works.
// ─────────────────────────────────────────────────────────────────────────────

import { useAuth } from '@/context/AuthContext'

export default function DashboardPage() {
  // useAuth() gives us the logged-in user and the logout function.
  // Because this page is wrapped in ProtectedRoute, we know for certain
  // that user is NOT null here — TypeScript might not know that,
  // but the runtime guarantees it.
  const { user, logout } = useAuth()

  return (
    <div style={{
      minHeight: '100vh',
      fontFamily: 'var(--font-sans)',
      background: 'var(--color-bg-subtle)',
    }}>

      {/* Top navigation bar */}
      <nav style={{
        background: 'var(--color-bg)',
        borderBottom: `1px solid var(--color-border)`,
        padding: '0 24px',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* App name */}
        <span style={{
          fontWeight: 600,
          fontSize: '18px',
          color: 'var(--color-text-primary)',
          letterSpacing: '-0.3px',
        }}>
          DevFlow
        </span>

        {/* User info + logout */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          {/* Avatar */}
          {user?.avatarUrl && (
            <img
              src={user.avatarUrl}
              alt={user.username}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: `1px solid var(--color-border)`,
              }}
            />
          )}

          {/* Username */}
          <span style={{
            fontSize: '14px',
            color: 'var(--color-text-primary)',
            fontWeight: 500,
          }}>
            @{user?.username}
          </span>

          {/* Logout button */}
          <button
            onClick={logout}
            style={{
              padding: '6px 14px',
              border: `1px solid var(--color-border)`,
              borderRadius: 'var(--radius-md)',
              background: 'transparent',
              color: 'var(--color-text-secondary)',
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              const btn = e.currentTarget
              btn.style.background = 'var(--color-bg-subtle)'
              btn.style.color = 'var(--color-text-primary)'
            }}
            onMouseLeave={e => {
              const btn = e.currentTarget
              btn.style.background = 'transparent'
              btn.style.color = 'var(--color-text-secondary)'
            }}
          >
            Log out
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main style={{ padding: '40px 24px', maxWidth: '960px', margin: '0 auto' }}>

        {/* Welcome message */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 600,
            margin: '0 0 8px',
            color: 'var(--color-text-primary)',
          }}>
            Welcome, {user?.username}
          </h1>
          <p style={{
            fontSize: '15px',
            color: 'var(--color-text-secondary)',
            margin: 0,
          }}>
            Your DevFlow dashboard is ready. Phase 2 coming soon.
          </p>
        </div>

        {/* User info card — proof the auth worked */}
        <div style={{
          background: 'var(--color-bg)',
          border: `1px solid var(--color-border)`,
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          maxWidth: '480px',
        }}>
          {user?.avatarUrl && (
            <img
              src={user.avatarUrl}
              alt={user.username}
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                border: `2px solid var(--color-border)`,
                flexShrink: 0,
              }}
            />
          )}
          <div>
            <p style={{
              margin: '0 0 4px',
              fontWeight: 600,
              fontSize: '16px',
              color: 'var(--color-text-primary)',
            }}>
              @{user?.username}
            </p>
            <p style={{
              margin: '0 0 4px',
              fontSize: '13px',
              color: 'var(--color-text-secondary)',
            }}>
              {user?.email}
            </p>
            <p style={{
              margin: 0,
              fontSize: '12px',
              color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-mono)',
            }}>
              ID: {user?.id}
            </p>
          </div>
        </div>

        {/* Phase status */}
        <div style={{
          marginTop: '32px',
          padding: '16px 20px',
          background: '#F0FDF4',
          border: '1px solid #86EFAC',
          borderRadius: 'var(--radius-md)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          color: '#166534',
        }}>
          <span style={{ fontSize: '16px' }}>✓</span>
          Phase 1 complete — authentication working end to end
        </div>

      </main>
    </div>
  )
}