'use client'

import { useState } from 'react'
import { createSession } from '@/lib/api'
import { useSessions } from '@/hooks/useSessions'

export default function SpawnPanel() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { total, mutate } = useSessions()

  async function handleSpawn() {
    setLoading(true)
    setError(null)
    try {
      const session = await createSession()
      await mutate()
      window.open(session.session_url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to spawn session')
      setTimeout(() => setError(null), 5000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={handleSpawn}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-fg text-sm font-semibold hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="1" width="12" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M5.5 4.5L9 7l-3.5 2.5v-5z" fill="currentColor" />
        </svg>
        {loading ? 'Starting...' : 'Spawn VS Code Session'}
      </button>
      {total > 0 && !loading && (
        <span className="text-xs text-fg-subtle">
          {total} active session{total !== 1 ? 's' : ''}
        </span>
      )}
      {error && (
        <span className="text-xs text-danger animate-fade-in">{error}</span>
      )}
    </div>
  )
}
