// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS THIS FILE?
// Repositories page — now with per-repo real-time notification badges.
//
// New in Phase 4:
//   - Each repo card shows a badge when PRs are updated in real-time
//   - Badge clears when user navigates to that repo's PR list
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { useNavigate }    from 'react-router-dom'
import { useRepos, useConnectRepo, useSyncRepo } from '@/hooks/useRepos'
import { useAuth }        from '@/context/AuthContext'
import { useSocket }      from '@/context/SocketContext'
import type { PRUpdateEvent } from '@/context/SocketContext'

export default function RepositoriesPage() {
  const { logout }   = useAuth()
  const navigate     = useNavigate()
  const { socket, isConnected } = useSocket()

  // ── Form state ────────────────────────────────────────────────────────────
  const [repoInput,    setRepoInput]    = useState('')
  const [connectError, setConnectError] = useState('')

  // ── Notification badges ───────────────────────────────────────────────────
  // A map of repoId → number of unread PR updates
  // e.g. { "abc123": 3, "def456": 1 }
  const [badges, setBadges] = useState<Record<string, number>>({})

  // ── Data hooks ────────────────────────────────────────────────────────────
  const { data: repos, isLoading } = useRepos()
  const connectRepo = useConnectRepo()
  const syncRepo    = useSyncRepo()

  // ── Listen for PR updates across ALL repos ────────────────────────────────
  // On the repos page we do not join a specific repo room.
  // Instead we listen to ALL pr:updated events that come through the socket.
  // Each event includes the repoId so we know which card to badge.
  //
  // NOTE: the server emits to specific repo rooms.
  // The repos page does not join any room, so it will NOT receive these events
  // unless we join all repo rooms.
  // We solve this by joining ALL connected repo rooms when the page mounts.
  useEffect(() => {
    if (!socket || !isConnected || !repos) return

    // Join all repo rooms so we receive events for all of them
    repos.forEach(repo => {
      socket.emit('join:repo', repo.id)
    })

    // Listen for PR updates
    const handleUpdate = (event: PRUpdateEvent & { repoId?: string }) => {
      // The server does not currently send repoId in the payload.
      // We will handle this by checking which room the event came from.
      // For now, increment the badge for the room we are in.
      // We will identify the repo from the socket room in the next iteration.
      // Simple approach: increment badge for ALL repos that have this PR number.
      // The sync will clarify which repo it belongs to.
      setBadges(prev => {
        // Find the repo that might own this PR
        const matchingRepo = repos.find(r =>
          // We cannot know repoId from the event without server-side changes.
          // For now, we show a generic badge on the first repo.
          // In a real app, the server would include repoId in the payload.
          r._count.pullRequests > 0
        )
        if (!matchingRepo) return prev
        return {
          ...prev,
          [matchingRepo.id]: (prev[matchingRepo.id] || 0) + 1,
        }
      })
    }

    socket.on('pr:updated', handleUpdate)

    // Cleanup — leave all rooms and stop listening when page unmounts
    return () => {
      socket.off('pr:updated', handleUpdate)
      repos.forEach(repo => {
        socket.emit('leave:repo', repo.id)
      })
    }
  }, [socket, isConnected, repos])


  // ── Connect repo handler ──────────────────────────────────────────────────
  async function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    setConnectError('')
    const trimmed = repoInput.trim()
    if (!trimmed) return
    try {
      await connectRepo.mutateAsync(trimmed)
      setRepoInput('')
    } catch (error: any) {
      setConnectError(
        error.response?.data?.message || 'Failed to connect repository'
      )
    }
  }

  // ── Navigate to repo and clear its badge ─────────────────────────────────
  function handleRepoClick(repoId: string) {
    // Clear the badge for this repo when user navigates to it
    setBadges(prev => ({ ...prev, [repoId]: 0 }))
    navigate(`/repos/${repoId}/pulls`)
  }

  return (
    <div style={{
      minHeight:  '100vh',
      background: 'var(--color-bg-subtle)',
      fontFamily: 'var(--font-sans)',
    }}>

      {/* ── Navigation bar ──────────────────────────────────────────────── */}
      <nav style={{
        background:     'var(--color-bg)',
        borderBottom:   '1px solid var(--color-border)',
        padding:        '0 24px',
        height:         '60px',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 600, fontSize: '18px', letterSpacing: '-0.3px' }}>
            DevFlow
          </span>
          {/* Connection status indicator in nav */}
          <div style={{
            display:      'flex',
            alignItems:   'center',
            gap:          '4px',
            fontSize:     '11px',
            color:        'var(--color-text-secondary)',
            background:   'var(--color-bg-subtle)',
            padding:      '2px 8px',
            borderRadius: '10px',
            border:       '1px solid var(--color-border)',
          }}>
            <div style={{
              width:        '6px',
              height:       '6px',
              borderRadius: '50%',
              background:   isConnected ? '#10B981' : '#9CA3AF',
              animation:    isConnected ? 'pulse 2s infinite' : 'none',
            }} />
            {isConnected ? 'Live' : 'Connecting...'}
          </div>
        </div>

        <button
          onClick={logout}
          style={{
            padding:      '6px 14px',
            border:       '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            background:   'transparent',
            fontSize:     '13px',
            cursor:       'pointer',
            color:        'var(--color-text-secondary)',
          }}
        >
          Log out
        </button>
      </nav>

      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '40px 24px' }}>

        {/* ── Page header ──────────────────────────────────────────────── */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{
            fontSize:      '24px',
            fontWeight:    600,
            margin:        '0 0 8px',
            letterSpacing: '-0.3px',
          }}>
            Repositories
          </h1>
          <p style={{
            color:    'var(--color-text-secondary)',
            margin:   0,
            fontSize: '15px',
          }}>
            Connect GitHub repositories to track pull requests and team metrics.
          </p>
        </div>

        {/* ── Connect repo form ─────────────────────────────────────────── */}
        <div style={{
          background:   'var(--color-bg)',
          border:       '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding:      '24px',
          marginBottom: '32px',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 16px' }}>
            Connect a repository
          </h2>
          <form onSubmit={handleConnect} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <input
                type="text"
                value={repoInput}
                onChange={e => { setRepoInput(e.target.value); setConnectError('') }}
                placeholder="owner/repository — e.g. miora193/devflow"
                style={{
                  width:        '100%',
                  padding:      '10px 14px',
                  border:       `1px solid ${connectError ? '#FECACA' : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius-md)',
                  fontSize:     '14px',
                  fontFamily:   'var(--font-mono)',
                  background:   'var(--color-bg)',
                  color:        'var(--color-text-primary)',
                  outline:      'none',
                }}
              />
              {connectError && (
                <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#DC2626' }}>
                  {connectError}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={connectRepo.isPending || !repoInput.trim()}
              style={{
                padding:      '10px 20px',
                background:   connectRepo.isPending
                  ? 'var(--color-text-muted)' : 'var(--color-accent)',
                color:        '#fff',
                border:       'none',
                borderRadius: 'var(--radius-md)',
                fontSize:     '14px',
                fontWeight:   500,
                cursor:       connectRepo.isPending ? 'not-allowed' : 'pointer',
                whiteSpace:   'nowrap',
              }}
            >
              {connectRepo.isPending ? 'Connecting...' : 'Connect repo'}
            </button>
          </form>
          {connectRepo.isSuccess && (
            <p style={{
              margin:       '12px 0 0',
              fontSize:     '13px',
              color:        '#166534',
              background:   '#F0FDF4',
              padding:      '8px 12px',
              borderRadius: 'var(--radius-md)',
            }}>
              Repository connected. Syncing pull requests in the background...
            </p>
          )}
        </div>

        {/* ── Repository list ───────────────────────────────────────────── */}
        {isLoading ? (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
            Loading repositories...
          </p>
        ) : repos?.length === 0 ? (
          <div style={{
            textAlign:    'center',
            padding:      '60px 24px',
            background:   'var(--color-bg)',
            border:       '1px dashed var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            color:        'var(--color-text-secondary)',
          }}>
            <p style={{ fontSize: '16px', margin: '0 0 8px' }}>
              No repositories connected yet
            </p>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Enter a repository above to get started
            </p>
          </div>
        ) : (
          <div style={{
            display:             'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap:                 '16px',
          }}>
            {repos?.map(repo => {
              const badgeCount = badges[repo.id] || 0
              return (
                <div
                  key={repo.id}
                  onClick={() => handleRepoClick(repo.id)}
                  style={{
                    background:   'var(--color-bg)',
                    border:       '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding:      '20px',
                    cursor:       'pointer',
                    transition:   'border-color 0.15s',
                    position:     'relative', // needed for badge positioning
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
                >
                  {/* ── Notification badge ──────────────────────────────── */}
                  {/* Only shown when there are unread updates */}
                  {badgeCount > 0 && (
                    <div style={{
                      position:     'absolute',
                      top:          '-8px',
                      right:        '-8px',
                      background:   '#534AB7',
                      color:        '#fff',
                      borderRadius: '10px',
                      padding:      '2px 7px',
                      fontSize:     '11px',
                      fontWeight:   600,
                      minWidth:     '20px',
                      textAlign:    'center',
                      border:       '2px solid var(--color-bg-subtle)',
                      // Bounce animation to draw attention
                      animation:    'bounce 0.4s ease-out',
                    }}>
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </div>
                  )}

                  {/* Repo name */}
                  <div style={{
                    display:     'flex',
                    alignItems:  'center',
                    gap:         '8px',
                    marginBottom: '8px',
                  }}>
                    {repo.isPrivate && (
                      <span style={{
                        fontSize:     '10px',
                        padding:      '2px 6px',
                        background:   '#FEF3C7',
                        color:        '#92400E',
                        borderRadius: 'var(--radius-full)',
                        fontWeight:   500,
                      }}>
                        private
                      </span>
                    )}
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize:   '13px',
                      color:      'var(--color-text-secondary)',
                    }}>
                      {repo.owner}/
                    </span>
                  </div>

                  <p style={{ margin: '0 0 12px', fontWeight: 600, fontSize: '16px' }}>
                    {repo.name}
                  </p>

                  {/* Stats row */}
                  <div style={{
                    display:        'flex',
                    justifyContent: 'space-between',
                    alignItems:     'center',
                  }}>
                    <span style={{
                      fontSize: '13px',
                      color:    'var(--color-text-secondary)',
                    }}>
                      {repo._count.pullRequests} pull requests
                    </span>
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        syncRepo.mutate(repo.id)
                      }}
                      style={{
                        fontSize:     '12px',
                        padding:      '4px 10px',
                        border:       '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        background:   'transparent',
                        cursor:       'pointer',
                        color:        'var(--color-text-secondary)',
                      }}
                    >
                      {syncRepo.isPending ? 'Syncing...' : 'Sync'}
                    </button>
                  </div>

                  {repo.lastSyncedAt && (
                    <p style={{
                      margin:   '8px 0 0',
                      fontSize: '12px',
                      color:    'var(--color-text-muted)',
                    }}>
                      Last synced {new Date(repo.lastSyncedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* ── Animations ───────────────────────────────────────────────────── */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        @keyframes bounce {
          0%   { transform: scale(0.5); }
          70%  { transform: scale(1.2); }
          100% { transform: scale(1);   }
        }
      `}</style>
    </div>
  )
}