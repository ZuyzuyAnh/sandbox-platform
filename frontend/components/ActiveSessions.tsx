'use client'

import { useState } from 'react'
import { terminateSession } from '@/lib/api'
import { useSessions } from '@/hooks/useSessions'
import { Session } from '@/types'

function formatExpiry(expiresAt: string): string {
  const diff = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
  if (diff <= 0) return 'Expired'
  const m = Math.floor(diff / 60)
  const s = diff % 60
  return `${m}m ${s < 10 ? '0' : ''}${s}s`
}

function SessionRow({
  session,
  onTerminate,
}: {
  session: Session
  onTerminate: (id: string) => Promise<void>
}) {
  const [terminating, setTerminating] = useState(false)
  const expired = new Date(session.expires_at).getTime() <= Date.now()

  async function handleTerminate() {
    setTerminating(true)
    try {
      await onTerminate(session.sandbox_id)
    } finally {
      setTerminating(false)
    }
  }

  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className={`py-2 pr-4 font-mono text-xs ${expired ? 'text-gray-400' : 'text-gray-600'}`}>
        {session.sandbox_id.slice(0, 8)}
      </td>
      <td className={`py-2 pr-4 text-xs ${expired ? 'text-gray-400' : 'text-gray-500'}`}>
        {formatExpiry(session.expires_at)}
      </td>
      <td className="py-2 pr-2">
        {!expired && (
          <a
            href={session.session_url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 text-xs rounded-md bg-violet-600 text-white hover:bg-violet-700 transition-colors"
          >
            Open
          </a>
        )}
      </td>
      <td className="py-2">
        <button
          onClick={handleTerminate}
          disabled={terminating}
          className="px-3 py-1 text-xs rounded-md bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-700 disabled:opacity-50 transition-colors"
        >
          {terminating ? '…' : '✕'}
        </button>
      </td>
    </tr>
  )
}

export default function ActiveSessions() {
  const { sessions, isLoading, mutate } = useSessions()

  async function handleTerminate(id: string) {
    await terminateSession(id)
    await mutate()
  }

  if (sessions.length === 0 && !isLoading) return null

  return (
    <div className="flex flex-col">
      <h2 className="text-sm font-semibold text-gray-700 mb-2">
        Active VS Code sessions
        {sessions.length > 0 && (
          <span className="ml-2 text-xs font-normal text-gray-400">({sessions.length})</span>
        )}
      </h2>
      {isLoading ? (
        <div className="text-xs text-gray-400 animate-pulse">Loading sessions…</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
              <th className="pb-1 font-medium">Session</th>
              <th className="pb-1 font-medium">Expires</th>
              <th className="pb-1 font-medium" colSpan={2}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map(s => (
              <SessionRow key={s.sandbox_id} session={s} onTerminate={handleTerminate} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
