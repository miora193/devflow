// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS THIS FILE?
// A hook that manages a list of active toast notifications.
//
// It provides:
//   toasts   — the current list of toasts to display
//   addToast — call this to show a new toast
//   removeToast — call this to dismiss a toast
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react'
import type { ToastMessage } from '@/components/Toast'

export function useToast() {
  // An array of active toasts
  // Each toast has a unique ID so React can track them
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  // Add a new toast to the list
  // useCallback means this function reference stays stable across renders
  // Important because it is used in useEffect dependency arrays
  const addToast = useCallback((
    message: string,
    type: ToastMessage['type']
  ) => {
    const id = `toast-${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev, { id, message, type }])
  }, [])

  // Remove a toast by ID — called when it is dismissed or times out
  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { toasts, addToast, removeToast }
}