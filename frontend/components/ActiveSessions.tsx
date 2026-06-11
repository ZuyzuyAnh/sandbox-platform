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

function SessionRow({ session, onTerminate }: { session: Session; onTerminate: (id: string) => Promise<void> }) {
  const [terminating, setTerminating] = useState(false)
  const expired = new Date(session.expires_at).getTime() <= Date.now()

  async function handleTerminate() {
    setTerminating(true)
    try { await onTerminate(session.sandbox_id) }
    finally { setTerminating(false) }
  }

  return (
    <tr className="border-b border-[#1E293B] last:border-0">
      <td className={`py-2 pr-4 font-mono text-xs ${expired ? 'text-[#475569]' : 'text-[#94A3B8]'}`}>
        {session.sandbox_id.slice(0, 8)}
      </td>
      <td className={`py-2 pr-4 font-mono text-xs ${expired ? 'text-[#475569]' : 'text-[#64748B]'}`}>
        {formatExpiry(session.expires_at)}
      </td>
      <td className="py-2 pr-2">
        {!expired && (
          <a
            href={session.session_url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 text-xs rounded-md bg-[rgba(168,85,247,0.15)] text-[#A855F7] hover:bg-[rgba(168,85,247,0.25)] transition-colors"
          >
            Open
          </a>
        )}
      </td>
      <td className="py-2">
        <button
          onClick={handleTerminate}
          disabled={terminating}
          className="px-2.5 py-1 text-xs rounded-md bg-[#334155] text-[#64748B] hover:bg-[rgba(239,68,68,0.15)] hover:text-[#EF4444] disabled:opacity-50 transition-colors cursor-pointer"
        >
          {terminating ? '...' : '✕'}
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
      <h2 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-widest mb-2">
        Active VS Code sessions
        {sessions.length > 0 && (
          <span className="ml-2 text-[#475569] normal-case tracking-normal">({sessions.length})</span>
        )}
      </h2>
      {isLoading ? (
        <div className="text-xs text-[#475569] animate-pulse">Loading sessions...</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[#475569] border-b border-[#334155]">
              <th className="pb-1.5 font-medium">Session</th>
              <th className="pb-1.5 font-medium">Expires</th>
              <th className="pb-1.5 font-medium" colSpan={2}>Actions</th>
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
