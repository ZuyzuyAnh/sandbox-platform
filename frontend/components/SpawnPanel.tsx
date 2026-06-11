'use client'

import { useState } from 'react'
import { createSession } from '@/lib/api'
import { useSessions } from '@/hooks/useSessions'

export default function SpawnPanel() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { mutate } = useSessions()

  async function handleSpawn() {
    setLoading(true)
    setError(null)
    try {
      const session = await createSession()
      await mutate()
      window.open(session.session_url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to spawn session')
      setTimeout(() => setError(null), 6000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={handleSpawn}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-fg text-xs font-semibold hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all cursor-pointer"
      >
        {loading ? (
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="animate-spin">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.6" strokeOpacity="0.3" />
            <path d="M12.5 7A5.5 5.5 0 0 0 7 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
        {loading ? 'Starting...' : 'New session'}
      </button>

      {/* Error toast — SpawnPanel lives in the topbar, no room for inline text */}
      {error && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm animate-rise">
          <div className="flex items-start gap-3 bg-surface border border-danger/40 rounded-xl px-4 py-3 shadow-2xl" role="alert">
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none" className="flex-shrink-0 mt-0.5 text-danger">
              <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M9 5.5V10M9 12.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <p className="flex-1 text-xs text-fg-muted">{error}</p>
            <button
              onClick={() => setError(null)}
              aria-label="Dismiss"
              className="text-fg-subtle hover:text-fg leading-none flex-shrink-0 cursor-pointer"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  )
}
