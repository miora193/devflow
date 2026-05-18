import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useRepos } from '@/hooks/useRepos'

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { data: repos } = useRepos()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg-subtle)', fontFamily: 'var(--font-sans)' }}>

      {/* Nav */}
      <nav style={{
        background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)',
        padding: '0 24px', height: '60px', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span
          onClick={() => navigate('/dashboard')}
          style={{ fontWeight: 600, fontSize: '18px', letterSpacing: '-0.3px', cursor: 'pointer' }}
        >
          DevFlow
        </span>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button onClick={() => navigate('/repos')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
            Repositories
          </button>
          <img src={user?.avatarUrl} alt={user?.username}
            style={{ width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer' }}
            onClick={() => navigate('/repos')} />
          <button onClick={logout}
            style={{ padding: '6px 14px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'transparent', fontSize: '13px', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
            Log out
          </button>
        </div>
      </nav>

      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '40px 24px' }}>

        {/* Welcome */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 6px', letterSpacing: '-0.3px' }}>
            Welcome back, {user?.username} 👋
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', margin: 0, fontSize: '15px' }}>
            Track your team's pull request metrics and insights.
          </p>
        </div>

        {/* Quick action cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px', marginBottom: '32px' }}>

          {/* Repositories card */}
          <div onClick={() => navigate('/repos')} style={{
            background: 'var(--color-bg)', border: '1px solid var(--color-border)',
            borderRadius: '12px', padding: '24px', cursor: 'pointer', transition: 'border-color 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#534AB7' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)' }}>
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>📁</div>
            <p style={{ fontWeight: 600, fontSize: '16px', margin: '0 0 6px' }}>Repositories</p>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 12px' }}>
              {repos && repos.length > 0
                ? `${repos.length} repo${repos.length > 1 ? 's' : ''} connected`
                : 'Connect your GitHub repositories'}
            </p>
            <span style={{ fontSize: '12px', color: '#534AB7', fontWeight: 500 }}>View repos →</span>
          </div>

          {/* Analytics card */}
          <div onClick={() => repos && repos.length > 0 ? navigate(`/repos/${repos[0].id}/analytics`) : navigate('/repos')}
            style={{
              background: 'var(--color-bg)', border: '1px solid var(--color-border)',
              borderRadius: '12px', padding: '24px', cursor: 'pointer', transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#1D9E75' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)' }}>
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>📊</div>
            <p style={{ fontWeight: 600, fontSize: '16px', margin: '0 0 6px' }}>Analytics</p>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 12px' }}>
              Cycle time, velocity, review depth, heatmap
            </p>
            <span style={{ fontSize: '12px', color: '#1D9E75', fontWeight: 500 }}>View charts →</span>
          </div>

          {/* AI Review card */}
          <div onClick={() => repos && repos.length > 0 ? navigate(`/repos/${repos[0].id}/pulls`) : navigate('/repos')}
            style={{
              background: 'var(--color-bg)', border: '1px solid var(--color-border)',
              borderRadius: '12px', padding: '24px', cursor: 'pointer', transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#991B1B' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)' }}>
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>✦</div>
            <p style={{ fontWeight: 600, fontSize: '16px', margin: '0 0 6px' }}>AI Review</p>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 12px' }}>
              AI-powered pull request analysis
            </p>
            <span style={{ fontSize: '12px', color: '#991B1B', fontWeight: 500 }}>Analyse PRs →</span>
          </div>
        </div>

        {/* Recent repos */}
        {repos && repos.length > 0 && (
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 14px' }}>
              Connected Repositories
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {repos.slice(0, 5).map(repo => (
                <div key={repo.id} onClick={() => navigate(`/repos/${repo.id}/pulls`)}
                  style={{
                    background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                    borderRadius: '10px', padding: '14px 18px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#534AB7' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '16px' }}>📦</span>
                    <div>
                      <p style={{ fontWeight: 500, fontSize: '14px', margin: 0 }}>{repo.fullName}</p>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
                        {repo._count.pullRequests} pull requests
                      </p>
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', color: '#534AB7' }}>View PRs →</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {repos && repos.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '60px 24px', background: 'var(--color-bg)',
            border: '1px dashed var(--color-border)', borderRadius: '12px',
          }}>
            <p style={{ fontSize: '40px', margin: '0 0 12px' }}>📁</p>
            <p style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 8px' }}>No repositories yet</p>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: '0 0 20px' }}>
              Connect a GitHub repository to start tracking pull requests
            </p>
            <button onClick={() => navigate('/repos')} style={{
              padding: '10px 24px', background: '#534AB7', color: '#fff',
              border: 'none', borderRadius: '8px', fontSize: '14px',
              fontWeight: 500, cursor: 'pointer',
            }}>
              Connect a repository
            </button>
          </div>
        )}
      </main>
    </div>
  )
}