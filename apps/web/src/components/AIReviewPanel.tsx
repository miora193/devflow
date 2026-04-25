import { useEffect, useRef } from 'react'
import { useAIReview }       from '@/hooks/useAIReview'

interface PullRequestSummary {
  id:              string
  githubNumber:    number
  title:           string
  state:           string
  authorUsername:  string
  changedFiles:    number
  additions:       number
  deletions:       number
  reviewsCount:    number
  commentsCount:   number
  githubUrl:       string
}

interface AIReviewPanelProps {
  pr:      PullRequestSummary | null
  onClose: () => void
}

function renderMarkdown(text: string): string {
  return text
    .replace(/^## (.+)$/gm, '<strong style="display:block;margin-top:14px;margin-bottom:4px;font-size:13px;color:var(--color-text-primary)">$1</strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>')
}

export default function AIReviewPanel({ pr, onClose }: AIReviewPanelProps) {
  const { content, isStreaming, isComplete, error, startReview, reset } = useAIReview()
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (contentRef.current && isStreaming) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [content, isStreaming])

  useEffect(() => {
    reset()
  }, [pr?.id])

  if (!pr) return null

  function handleCopy() {
    navigator.clipboard.writeText(content)
  }

  const STATE_COLORS: Record<string, { bg: string; text: string }> = {
    open:   { bg: '#DCFCE7', text: '#166534' },
    merged: { bg: '#EDE9FE', text: '#5B21B6' },
    closed: { bg: '#FEE2E2', text: '#991B1B' },
  }
  const stateColors = STATE_COLORS[pr.state] || { bg: '#F3F4F6', text: '#374151' }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.2)',
          zIndex: 40, animation: 'fadeIn 0.2s ease-out',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '420px', maxWidth: '100vw',
        background: 'var(--color-bg)',
        borderLeft: '1px solid var(--color-border)',
        zIndex: 50, display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.25s ease-out',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
      }}>

        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'flex-start', gap: '12px', flexShrink: 0,
        }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: '#EEEDFE', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '16px', flexShrink: 0,
          }}>
            ✦
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: '11px', color: 'var(--color-text-secondary)',
              margin: '0 0 2px', textTransform: 'uppercase',
              letterSpacing: '0.05em', fontWeight: 500,
            }}>
              AI Review
            </p>
            <p style={{
              fontSize: '13px', fontWeight: 500, margin: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              color: 'var(--color-text-primary)',
            }}>
              #{pr.githubNumber} {pr.title}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--color-text-secondary)', fontSize: '20px',
              lineHeight: 1, padding: '2px 4px', flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* PR metadata */}
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--color-border)',
          display: 'flex', gap: '8px', flexWrap: 'wrap', flexShrink: 0,
        }}>
          <span style={{
            fontSize: '11px', fontWeight: 500, padding: '3px 8px',
            borderRadius: '6px', background: stateColors.bg, color: stateColors.text,
          }}>
            {pr.state}
          </span>
          <span style={{
            fontSize: '11px', color: 'var(--color-text-secondary)',
            padding: '3px 8px', background: 'var(--color-bg-subtle)', borderRadius: '6px',
          }}>
            {pr.changedFiles} files
          </span>
          <span style={{
            fontSize: '11px', padding: '3px 8px',
            background: 'var(--color-bg-subtle)', borderRadius: '6px',
          }}>
            <span style={{ color: '#166534', fontWeight: 500 }}>+{pr.additions}</span>
            {' '}
            <span style={{ color: '#991B1B', fontWeight: 500 }}>-{pr.deletions}</span>
          </span>
          <span style={{
            fontSize: '11px', color: 'var(--color-text-secondary)',
            padding: '3px 8px', background: 'var(--color-bg-subtle)', borderRadius: '6px',
          }}>
            {pr.reviewsCount} review{pr.reviewsCount !== 1 ? 's' : ''}
          </span>
          <span style={{
            fontSize: '11px', color: 'var(--color-text-secondary)',
            padding: '3px 8px', background: 'var(--color-bg-subtle)', borderRadius: '6px',
          }}>
            @{pr.authorUsername}
          </span>
        </div>

        {/* Content area */}
        <div ref={contentRef} style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

          {/* Initial state */}
          {!content && !isStreaming && !error && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '100%', gap: '12px',
              textAlign: 'center', padding: '40px 20px',
            }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px',
                background: '#EEEDFE', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '24px',
              }}>
                ✦
              </div>
              <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>
                Ready to analyse
              </p>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Click Analyse to get an AI-powered review of this pull request — cycle time, review coverage, risk signals, and recommendations.
              </p>
            </div>
          )}

          {/* Loading dots */}
          {isStreaming && !content && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: '#534AB7',
                    animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
              Analysing PR...
            </div>
          )}

          {/* Streamed content */}
          {content && (
            <div
              style={{ fontSize: '13px', lineHeight: 1.75, color: 'var(--color-text-primary)' }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
          )}

          {/* Blinking cursor */}
          {isStreaming && content && (
            <span style={{
              display: 'inline-block', width: '2px', height: '14px',
              background: '#534AB7', marginLeft: '2px',
              animation: 'blink 1s step-end infinite', verticalAlign: 'text-bottom',
            }} />
          )}

          {/* Error */}
          {error && (
            <div style={{
              background: '#FEE2E2', border: '1px solid #FECACA',
              borderRadius: '8px', padding: '12px 14px',
              fontSize: '13px', color: '#991B1B',
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px', borderTop: '1px solid var(--color-border)',
          display: 'flex', gap: '8px', flexShrink: 0,
        }}>
          <button
            onClick={() => startReview(pr.id)}
            disabled={isStreaming}
            style={{
              flex: 1, padding: '10px 16px',
              background: isStreaming ? 'var(--color-bg-subtle)' : '#534AB7',
              color: isStreaming ? 'var(--color-text-secondary)' : '#fff',
              border: 'none', borderRadius: 'var(--radius-md)',
              fontSize: '13px', fontWeight: 500,
              cursor: isStreaming ? 'not-allowed' : 'pointer',
            }}
          >
            {isStreaming ? 'Analysing...' : isComplete ? 'Re-analyse' : 'Analyse'}
          </button>

          {isComplete && (
            <button
              onClick={handleCopy}
              style={{
                padding: '10px 14px', background: 'transparent',
                color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)', fontSize: '13px', cursor: 'pointer',
              }}
            >
              Copy
            </button>
          )}

          
          <a href={pr.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '10px 14px', background: 'transparent',
              color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)', fontSize: '13px', cursor: 'pointer',
              textDecoration: 'none', display: 'flex', alignItems: 'center',
            }}
          >
            GitHub ↗
          </a>
        </div>

      </div>

      {/* Animations */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%           { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </>
  )
}