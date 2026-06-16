// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS THIS FILE?
// The repositories page — shows all connected repos and lets users add new ones.
//
// Layout:
//   - Header with "Connect repository" form
//   - Grid of repo cards, each showing name, PR count, last synced time
//   - Click a repo card → goes to /repos/:id/pulls
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRepos, useConnectRepo, useSyncRepo } from '@/hooks/useRepos'
import { useAuth } from '@/context/AuthContext'

export default function RepositoriesPage() {
  const { logout } = useAuth()
  const navigate   = useNavigate()

  // State for the connect repo form
  const [repoInput, setRepoInput]   = useState('')
  const [connectError, setConnectError] = useState('')

  // React Query hooks
  const { data: repos, isLoading } = useRepos()
  const connectRepo = useConnectRepo()
  const syncRepo    = useSyncRepo()

  // Handle connecting a new repo
  async function handleConnect(e: React.FormEvent) {
    // Prevent the form from doing a full page refresh
    e.preventDefault()
    setConnectError('')

    const trimmed = repoInput.trim()
    if (!trimmed) return

    try {
      await connectRepo.mutateAsync(trimmed)
      // Clear the input on success
      setRepoInput('')
    } catch (error: any) {
      // Show the error message from the API
      setConnectError(
        error.response?.data?.message || 'Failed to connect repository'
      )
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg-subtle)', fontFamily: 'var(--font-sans)' }}>

      {/* ── Navigation bar ── */}
      <nav style={{
        background:   'var(--color-bg)',
        borderBottom: '1px solid var(--color-border)',
        padding:      '0 24px',
        height:       '60px',
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontWeight: 600, fontSize: '18px', letterSpacing: '-0.3px' }}>
          DevFlow
        </span>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {/* Link to PRs page — we will build this next */}
          <button
            onClick={() => navigate('/dashboard')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--color-text-secondary)' }}
          >
            Dashboard
          </button>
          <button
            onClick={logout}
            style={{ padding: '6px 14px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'transparent', fontSize: '13px', cursor: 'pointer', color: 'var(--color-text-secondary)' }}
          >
            Log out
          </button>
        </div>
      </nav>

      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '40px 24px' }}>

        {/* ── Page header ── */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 8px', letterSpacing: '-0.3px' }}>
            Repositories
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', margin: 0, fontSize: '15px' }}>
            Connect GitHub repositories to track pull requests and team metrics.
          </p>
        </div>

        {/* ── Connect repo form ── */}
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
                onChange={e => {
                  setRepoInput(e.target.value)
                  setConnectError('')
                }}
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
              {/* Show error if connection failed */}
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
                background:   connectRepo.isPending ? 'var(--color-text-muted)' : 'var(--color-accent)',
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

          {/* Success message */}
          {connectRepo.isSuccess && (
            <p style={{ margin: '12px 0 0', fontSize: '13px', color: '#166534', background: '#F0FDF4', padding: '8px 12px', borderRadius: 'var(--radius-md)' }}>
              Repository connected. Syncing pull requests in the background...
            </p>
          )}
        </div>

        {/* ── Repository list ── */}
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
            <p style={{ fontSize: '16px', margin: '0 0 8px' }}>No repositories connected yet</p>
            <p style={{ fontSize: '14px', margin: 0 }}>Enter a repository above to get started</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {repos?.map(repo => (
              <div
                key={repo.id}
                onClick={() => navigate(`/repos/${repo.id}/pulls`)}
                style={{
                  background:   'var(--color-bg)',
                  border:       '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding:      '20px',
                  cursor:       'pointer',
                  transition:   'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
              >
                {/* Repo name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  {/* Lock icon for private repos */}
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
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                    {repo.owner}/
                  </span>
                </div>
                <p style={{ margin: '0 0 12px', fontWeight: 600, fontSize: '16px' }}>
                  {repo.name}
                </p>

                {/* Stats row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                    {repo._count.pullRequests} pull requests
                  </span>
                  {/* Sync button */}
                  <button
                    onClick={e => {
                      // Stop the click from also navigating to the PRs page
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

                {/* Last synced time */}
                {repo.lastSyncedAt && (
                  <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    Last synced {new Date(repo.lastSyncedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}