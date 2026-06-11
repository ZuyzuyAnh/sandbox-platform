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
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#22C55E] text-[#0F172A] text-sm font-medium hover:bg-[#16A34A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M4 5l3 2-3 2V5z" fill="currentColor"/>
          <path d="M8 9h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        {loading ? 'Starting...' : 'Spawn VS Code Session'}
      </button>
      {total > 0 && !loading && (
        <span className="text-xs text-[#475569]">
          {total} active session{total !== 1 ? 's' : ''}
        </span>
      )}
      {error && (
        <span className="text-xs text-[#EF4444]">{error}</span>
      )}
    </div>
  )
}
