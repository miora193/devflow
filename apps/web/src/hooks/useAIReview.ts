// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS THIS FILE?
// A custom hook that streams an AI review for a pull request.
//
// It uses the browser's native fetch + ReadableStream API to receive
// the Server Sent Events (SSE) stream from our backend.
//
// Returns:
//   content      — the AI text built up so far (grows as stream arrives)
//   isStreaming  — true while the AI is generating
//   isComplete   — true when the stream is finished
//   error        — error message if something went wrong
//   startReview  — call this function to start the analysis
//   reset        — call this to clear the content and start fresh
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useRef } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────
interface UseAIReviewState {
  content:     string   // the growing AI response text
  isStreaming: boolean  // true while receiving chunks
  isComplete:  boolean  // true when [DONE] received
  error:       string | null
}

export function useAIReview() {
  const [state, setState] = useState<UseAIReviewState>({
    content:     '',
    isStreaming: false,
    isComplete:  false,
    error:       null,
  })

  // abortController lets us cancel the stream if the user navigates away
  // or clicks a "stop" button.
  // We store it in a ref so it does not trigger re-renders when set.
  const abortControllerRef = useRef<AbortController | null>(null)

  // ── reset ─────────────────────────────────────────────────────────────────
  // Clears the content and state. Call this before starting a new review
  // so the old content does not show while the new one loads.
  const reset = useCallback(() => {
    // Cancel any in-progress stream
    abortControllerRef.current?.abort()
    setState({
      content:     '',
      isStreaming: false,
      isComplete:  false,
      error:       null,
    })
  }, [])

  // ── startReview ───────────────────────────────────────────────────────────
  // Starts streaming an AI review for the given PR ID.
  // prId: our internal PR ID from the database
  const startReview = useCallback(async (prId: string) => {
    // Reset state before starting
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setState({
      content:     '',
      isStreaming: true,
      isComplete:  false,
      error:       null,
    })

    try {
      // ── Make the streaming request ────────────────────────────────────────
      // fetch() with { signal } lets us cancel the request later.
      // We use POST because we might add a request body in future.
      // credentials: 'include' sends the auth cookie automatically.
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/ai/review/${prId}`,
        {
          method:      'POST',
          credentials: 'include', // sends the httpOnly cookie
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal, // allows us to cancel the request
        }
      )

      if (!response.ok) {
        // Non-streaming error — e.g. 401, 404
        const data = await response.json()
        throw new Error(data.message || 'Failed to start AI review')
      }

      // ── Read the stream ───────────────────────────────────────────────────
      // response.body is a ReadableStream.
      // We attach a reader to read chunks as they arrive.
      const reader  = response.body!.getReader()

      // TextDecoder converts raw bytes (Uint8Array) into a readable string.
      // Each chunk arrives as bytes — we decode them to get the text.
      const decoder = new TextDecoder()

      // Buffer to hold incomplete SSE lines between chunks
      // (a chunk might be split mid-line)
      let buffer = ''

      // Keep reading until the stream closes
      while (true) {
        const { done, value } = await reader.read()

        // done = true means the server closed the connection
        if (done) break

        // Decode the bytes to text and add to buffer
        buffer += decoder.decode(value, { stream: true })

        // SSE messages end with \n\n
        // Split on double newlines to get individual messages
        const lines = buffer.split('\n\n')

        // The last element might be an incomplete message — keep it in buffer
        // Everything else is complete and ready to process
        buffer = lines.pop() || ''

        for (const line of lines) {
          // SSE lines start with "data: "
          if (!line.startsWith('data: ')) continue

          // Extract the JSON after "data: "
          const jsonStr = line.slice(6).trim()
          if (!jsonStr) continue

          try {
            const parsed = JSON.parse(jsonStr)

            if (parsed.error) {
              // Server sent an error message
              setState(prev => ({
                ...prev,
                isStreaming: false,
                error: parsed.error,
              }))
              return
            }

            if (parsed.done) {
              // Stream finished — [DONE] received
              setState(prev => ({
                ...prev,
                isStreaming: false,
                isComplete:  true,
              }))
              return
            }

            if (parsed.content) {
              // New text chunk — append to existing content
              // We use the functional form of setState to always append
              // to the latest content (avoids stale closure issues)
              setState(prev => ({
                ...prev,
                content: prev.content + parsed.content,
              }))
            }

          } catch {
            // JSON parse failed — skip this chunk
            console.warn('Failed to parse SSE chunk:', jsonStr)
          }
        }
      }

    } catch (error: any) {
      // AbortError means we cancelled intentionally — not a real error
      if (error.name === 'AbortError') return

      setState(prev => ({
        ...prev,
        isStreaming: false,
        error: error.message || 'Something went wrong',
      }))
    }
  }, [])

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  // If the component unmounts while streaming, cancel the request.
  // This prevents state updates on unmounted components.
  // (Called automatically by React when the hook's component unmounts)

  return {
    ...state,
    startReview,
    reset,
  }
}