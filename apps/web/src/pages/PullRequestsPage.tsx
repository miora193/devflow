// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS THIS FILE?
// PR list page — now with real-time updates via Socket.io.
//
// New in Phase 4:
//   - useRepoSocket joins the repo room and listens for pr:updated events
//   - When an event arrives, React Query cache is invalidated → auto re-fetch
//   - Toast notifications show what changed
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSocket } from '@/context/SocketContext'
import { useQueryClient } from '@tanstack/react-query'
import { usePullRequests, useSyncRepo } from '@/hooks/useRepos'
import { useRepoSocket }                from '@/hooks/useRepoSocket'
import { useToast }                     from '@/hooks/useToast'
import Toast                            from '@/components/Toast'
import AIReviewPanel                    from '@/components/AIReviewPanel'
import type { PRUpdateEvent }           from '@/context/SocketContext'

const STATE_COLORS = {
  open:   { bg: '#DCFCE7', text: '#166534' },
  merged: { bg: '#EDE9FE', text: '#5B21B6' },
  closed: { bg: '#FEE2E2', text: '#991B1B' },
}

export default function PullRequestsPage() {
  const { id }      = useParams<{ id: string }>()
  const navigate    = useNavigate()
  const queryClient = useQueryClient()

  const [stateFilter, setStateFilter] = useState<string | undefined>(undefined)
  const [page, setPage]               = useState(1)

  const [selectedPR, setSelectedPR] = useState<{
    id:             string
    githubNumber:   number
    title:          string
    state:          string
    authorUsername: string
    changedFiles:   number
    additions:      number
    deletions:      number
    reviewsCount:   number
    commentsCount:  number
    githubUrl:      string
  } | null>(null)

  const { data, isLoading, isFetching } = usePullRequests(id!, stateFilter, page)
  const syncRepo = useSyncRepo()
  const { toasts, addToast, removeToast } = useToast()

  const handlePRUpdate = useCallback((event: PRUpdateEvent) => {
    queryClient.invalidateQueries({ queryKey: ['pulls', id] })
    const prLabel = `PR #${event.prNumber}: ${
      event.title.length > 35 ? event.title.slice(0, 35) + '…' : event.title
    }`
    addToast(prLabel, event.action)
  }, [id, queryClient, addToast])

  useRepoSocket(id!, handlePRUpdate)

  function handleFilterChange(newState: string | undefined) {
    setStateFilter(newState)
    setPage(1)
  }

  return (
    <div style={{
      minHeight:  '100vh',
      background: 'var(--color-bg-subtle)',
      fontFamily: 'var(--font-sans)',
    }}>

      {/* ── Navigation ── */}
      <nav style={{
        background:     'var(--color-bg)',
        borderBottom:   '1px solid var(--color-border)',
        padding:        '0 24px',
        height:         '60px',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        gap:            '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => navigate('/repos')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--color-text-secondary)' }}
          >
            ← Repositories
          </button>
          <span style={{ color: 'var(--color-border)', fontSize: '18px' }}>|</span>
          <span style={{ fontWeight: 600, fontSize: '16px' }}>Pull Requests</span>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => navigate(`/repos/${id}/analytics`)}
            style={{
              padding: '8px 16px', border: 'none', borderRadius: 'var(--radius-md)',
              background: '#534AB7', fontSize: '13px', cursor: 'pointer', color: '#fff', fontWeight: 500,
            }}
          >
            Analytics
          </button>
          <button
            onClick={() => syncRepo.mutate(id!)}
            disabled={syncRepo.isPending}
            style={{
              padding: '8px 16px', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)', background: 'transparent', fontSize: '13px',
              cursor: syncRepo.isPending ? 'not-allowed' : 'pointer', color: 'var(--color-text-secondary)',
            }}
          >
            {syncRepo.isPending ? 'Syncing...' : 'Sync now'}
          </button>
        </div>
      </nav>

      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '40px 24px' }}>

        {/* ── Filter tabs ── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: '24px',
        }}>
          <div style={{
            display: 'flex', gap: '4px', background: 'var(--color-bg)',
            border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '4px',
          }}>
            {[
              { label: 'All',    value: undefined },
              { label: 'Open',   value: 'open'    },
              { label: 'Merged', value: 'merged'  },
              { label: 'Closed', value: 'closed'  },
            ].map(({ label, value }) => (
              <button
                key={label}
                onClick={() => handleFilterChange(value)}
                style={{
                  padding: '6px 14px', borderRadius: '6px', border: 'none', fontSize: '13px',
                  fontWeight: stateFilter === value ? 500 : 400, cursor: 'pointer',
                  background: stateFilter === value ? 'var(--color-bg-subtle)' : 'transparent',
                  color: stateFilter === value ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <LiveIndicator repoId={id!} />
        </div>

        {/* ── PR list ── */}
        {isLoading ? (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
            Loading pull requests...
          </p>
        ) : data?.pullRequests.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 24px', background: 'var(--color-bg)',
            border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-lg)',
            color: 'var(--color-text-secondary)',
          }}>
            <p style={{ fontSize: '16px', margin: '0 0 8px' }}>No pull requests found</p>
            <p style={{ fontSize: '14px', margin: 0 }}>
              {stateFilter ? `No ${stateFilter} PRs` : 'Sync the repository to fetch PR data'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data?.pullRequests.map(pr => {
              const colors = STATE_COLORS[pr.state as keyof typeof STATE_COLORS]
              return (
                <div
                  key={pr.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '16px',
                    background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)', padding: '16px 20px', transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
                >
                  {/* Author avatar */}
                  <img
                    src={pr.authorAvatarUrl}
                    alt={pr.authorUsername}
                    style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0 }}
                  />

                  {/* PR info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{
                        fontSize: '11px', fontWeight: 500, padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        background: colors?.bg || '#F3F4F6', color: colors?.text || '#374151', flexShrink: 0,
                      }}>
                        {pr.state}
                      </span>
                      <span style={{
                        fontWeight: 500, fontSize: '14px',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {pr.title}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      #{pr.githubNumber} by @{pr.authorUsername} ·{' '}
                      {pr.headBranch} → {pr.baseBranch} ·{' '}
                      {pr.commentsCount} comments · {pr.reviewsCount} reviews
                    </p>
                  </div>

                  {/* Diff stats */}
                  <div style={{ flexShrink: 0, textAlign: 'right', fontSize: '12px' }}>
                    <span style={{ color: '#166534', fontWeight: 500 }}>+{pr.additions}</span>
                    {' '}
                    <span style={{ color: '#991B1B', fontWeight: 500 }}>-{pr.deletions}</span>
                    <p style={{ margin: '2px 0 0', color: 'var(--color-text-muted)' }}>
                      {pr.changedFiles} files
                    </p>
                  </div>

                  {/* AI Review button */}
                  <button
                    onClick={() => setSelectedPR({
                      id:             pr.id,
                      githubNumber:   pr.githubNumber,
                      title:          pr.title,
                      state:          pr.state,
                      authorUsername: pr.authorUsername,
                      changedFiles:   pr.changedFiles,
                      additions:      pr.additions,
                      deletions:      pr.deletions,
                      reviewsCount:   pr.reviewsCount,
                      commentsCount:  pr.commentsCount,
                      githubUrl:      pr.githubUrl,
                    })}
                    style={{
                      flexShrink:   0,
                      padding:      '5px 10px',
                      background:   '#EEEDFE',
                      color:        '#534AB7',
                      border:       '1px solid #C4C1F7',
                      borderRadius: 'var(--radius-md)',
                      fontSize:     '12px',
                      fontWeight:   500,
                      cursor:       'pointer',
                      whiteSpace:   'nowrap',
                    }}
                  >
                    ✦ AI
                  </button>

                  {/* GitHub link */}
                  
                    <a href={pr.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{
                      flexShrink:     0,
                      padding:        '5px 10px',
                      background:     'transparent',
                      color:          'var(--color-text-secondary)',
                      border:         '1px solid var(--color-border)',
                      borderRadius:   'var(--radius-md)',
                      fontSize:       '12px',
                      cursor:         'pointer',
                      textDecoration: 'none',
                    }}
                  >
                    ↗
                  </a>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Pagination ── */}
        {data && data.pagination.totalPages > 1 && (
          <div style={{
            display: 'flex', justifyContent: 'center',
            alignItems: 'center', gap: '12px', marginTop: '32px',
          }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || isFetching}
              style={{
                padding: '8px 16px', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)', background: 'transparent',
                cursor: page === 1 ? 'not-allowed' : 'pointer',
                fontSize: '13px', color: 'var(--color-text-secondary)',
              }}
            >
              Previous
            </button>
            <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Page {data.pagination.page} of {data.pagination.totalPages}
              {' · '}{data.pagination.total} total
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={!data.pagination.hasMore || isFetching}
              style={{
                padding: '8px 16px', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)', background: 'transparent',
                cursor: !data.pagination.hasMore ? 'not-allowed' : 'pointer',
                fontSize: '13px', color: 'var(--color-text-secondary)',
              }}
            >
              Next
            </button>
          </div>
        )}
      </main>

      {/* ── Toast container ── */}
      <div style={{
        position: 'fixed', bottom: '24px', right: '24px',
        display: 'flex', flexDirection: 'column-reverse', gap: '8px', zIndex: 1000,
      }}>
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onClose={removeToast} />
        ))}
      </div>

      {/* ── AI Review Panel ── */}
      <AIReviewPanel
        pr={selectedPR}
        onClose={() => setSelectedPR(null)}
      />

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
    
  )
}

function LiveIndicator({ repoId: _repoId }: { repoId: string }) {
  const { isConnected } = useSocket()
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      fontSize: '12px', color: 'var(--color-text-secondary)',
    }}>
      <div style={{
        width: '8px', height: '8px', borderRadius: '50%',
        background: isConnected ? '#10B981' : '#9CA3AF',
        animation: isConnected ? 'pulse 2s infinite' : 'none',
      }} />
      {isConnected ? 'Live' : 'Offline'}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}