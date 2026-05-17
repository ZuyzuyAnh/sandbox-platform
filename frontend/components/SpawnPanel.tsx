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
        className="px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Starting VS Code...' : 'Spawn VS Code Session'}
      </button>
      {total > 0 && !loading && (
        <span className="text-xs text-gray-400">
          {total} active session{total !== 1 ? 's' : ''}
        </span>
      )}
      {error && (
        <span className="text-sm text-red-600">{error}</span>
      )}
    </div>
  )
}
