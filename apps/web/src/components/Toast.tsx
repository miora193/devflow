// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS THIS FILE?
// A simple toast notification component.
// A "toast" is a small temporary message that appears briefly then disappears.
// Named after a toaster — the message "pops up" like toast.
//
// Usage:
//   <Toast message="PR #42 was merged" type="merged" onClose={() => {}} />
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ToastMessage {
  id:      string   // unique ID so React can track each toast
  message: string
  type:    'created' | 'updated' | 'merged' | 'closed'
}

interface ToastProps {
  toast:   ToastMessage
  onClose: (id: string) => void
}

// ── Colour per event type ─────────────────────────────────────────────────────
const TYPE_STYLES = {
  created: { bg: '#E1F5EE', border: '#1D9E75', text: '#085041', dot: '#1D9E75' },
  updated: { bg: '#EEEDFE', border: '#534AB7', text: '#3C3489', dot: '#534AB7' },
  merged:  { bg: '#EDE9FE', border: '#7C3AED', text: '#4C1D95', dot: '#7C3AED' },
  closed:  { bg: '#FEE2E2', border: '#EF4444', text: '#991B1B', dot: '#EF4444' },
}

// ── Labels per event type ─────────────────────────────────────────────────────
const TYPE_LABELS = {
  created: 'New PR',
  updated: 'PR updated',
  merged:  'PR merged',
  closed:  'PR closed',
}

export default function Toast({ toast, onClose }: ToastProps) {
  const styles = TYPE_STYLES[toast.type]

  // Auto-dismiss after 5 seconds
  // useEffect with a timer — clean up the timer on unmount to avoid memory leaks
  useEffect(() => {
    const timer = setTimeout(() => onClose(toast.id), 5000)
    return () => clearTimeout(timer)
  }, [toast.id, onClose])

  return (
    <div
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          '10px',
        background:   styles.bg,
        border:       `1px solid ${styles.border}`,
        borderRadius: '10px',
        padding:      '12px 16px',
        boxShadow:    '0 4px 12px rgba(0,0,0,0.1)',
        minWidth:     '280px',
        maxWidth:     '380px',
        // Slide in animation
        animation:    'slideIn 0.2s ease-out',
      }}
    >
      {/* Coloured dot indicator */}
      <div style={{
        width:        '8px',
        height:       '8px',
        borderRadius: '50%',
        background:   styles.dot,
        flexShrink:   0,
      }} />

      {/* Message content */}
      <div style={{ flex: 1 }}>
        <p style={{
          fontSize:   '12px',
          fontWeight: 500,
          color:      styles.text,
          margin:     '0 0 2px',
        }}>
          {TYPE_LABELS[toast.type]}
        </p>
        <p style={{
          fontSize: '12px',
          color:    styles.text,
          margin:   0,
          opacity:  0.8,
        }}>
          {toast.message}
        </p>
      </div>

      {/* Close button */}
      <button
        onClick={() => onClose(toast.id)}
        style={{
          background: 'transparent',
          border:     'none',
          cursor:     'pointer',
          color:      styles.text,
          fontSize:   '16px',
          lineHeight: 1,
          padding:    '0 2px',
          opacity:    0.6,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  )
}