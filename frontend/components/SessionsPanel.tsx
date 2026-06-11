'use client'

import { useEffect, useState } from 'react'
import SessionLogsModal from '@/components/SessionLogsModal'
import { terminateSession } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useSessions } from '@/hooks/useSessions'
import { Session } from '@/types'

function timeLeft(expiresAt: string, now: number): { label: string; urgent: boolean } {
  const diff = Math.floor((new Date(expiresAt).getTime() - now) / 1000)
  if (diff <= 0) return { label: 'Expired', urgent: true }
  const m = Math.floor(diff / 60)
  const s = diff % 60
  return { label: `${m}m ${s < 10 ? '0' : ''}${s}s`, urgent: diff < 300 }
}

function SessionRow({
  session, now, showOwner, onTerminate, onShowLogs,
}: {
  session: Session
  now: number
  showOwner: boolean
  onTerminate: (id: string) => Promise<void>
  onShowLogs: (s: Session) => void
}) {
  const [terminating, setTerminating] = useState(false)
  const [copied, setCopied] = useState(false)
  const { label, urgent } = timeLeft(session.expires_at, now)
  const expired = label === 'Expired'

  async function handleTerminate() {
    setTerminating(true)
    try { await onTerminate(session.sandbox_id) }
    finally { setTerminating(false) }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(session.session_url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-line/50 last:border-0">
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${expired ? 'bg-fg-subtle' : 'bg-ok animate-pulse-dot'}`} />

      <div className="flex-1 min-w-0">
        <p className="font-mono text-xs text-fg truncate">{session.sandbox_id.slice(0, 12)}</p>
        {showOwner && (
          <p className="text-[11px] text-fg-subtle truncate">{session.user_email ?? 'Unknown user'}</p>
        )}
      </div>

      <span
        className={`px-2 py-0.5 rounded-full font-mono text-[11px] flex-shrink-0 ${
          expired ? 'bg-raised text-fg-subtle' : urgent ? 'bg-warn/15 text-warn' : 'bg-raised text-fg-muted'
        }`}
        title={`Expires ${new Date(session.expires_at).toLocaleTimeString()}`}
      >
        {label}
      </span>

      <div className="flex items-center gap-1 flex-shrink-0">
        {!expired && (
          <>
            <a
              href={session.session_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 text-xs font-semibold rounded-md bg-accent text-accent-fg hover:bg-accent-hover active:scale-[0.97] transition-all"
            >
              Open
            </a>
            <button
              onClick={copyLink}
              aria-label="Copy session link"
              title="Copy link"
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                copied ? 'text-ok' : 'text-fg-subtle hover:text-fg hover:bg-raised'
              }`}
            >
              {copied ? (
                <svg width="13" height="13" viewBox="0 0 12 12" fill="none"><path d="M2 6.5L4.5 9 10 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 12 12" fill="none"><rect x="4" y="4" width="6.5" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" /><path d="M1.5 8.5v-6a1 1 0 0 1 1-1h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
              )}
            </button>
            <button
              onClick={() => onShowLogs(session)}
              className="px-2 py-1 text-xs font-medium rounded-md text-fg-subtle hover:text-fg hover:bg-raised transition-colors cursor-pointer"
            >
              Logs
            </button>
          </>
        )}
        <button
          onClick={handleTerminate}
          disabled={terminating}
          className="px-2 py-1 text-xs font-medium rounded-md text-fg-subtle hover:text-danger hover:bg-danger/10 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {terminating ? '...' : 'Terminate'}
        </button>
      </div>
    </div>
  )
}

export default function SessionsPanel() {
  const { sessions, isLoading, mutate } = useSessions()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [logsTarget, setLogsTarget] = useState<Session | null>(null)

  // Single shared clock so all countdowns tick together
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  async function handleTerminate(id: string) {
    await terminateSession(id)
    await mutate()
  }

  const userCount = new Set(sessions.map(s => s.user_email ?? s.sandbox_id)).size

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[10px] font-semibold text-fg-subtle uppercase tracking-widest">
          Active sessions
          {sessions.length > 0 && (
            <span className="ml-2 text-fg-subtle/70 normal-case tracking-normal">
              ({sessions.length}{isAdmin && userCount > 0 ? ` · ${userCount} user${userCount !== 1 ? 's' : ''}` : ''})
            </span>
          )}
        </h2>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1].map(i => <div key={i} className="h-10 skeleton rounded-lg" />)}
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-fg-subtle">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="opacity-40">
            <rect x="3" y="4" width="22" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 24h8M14 20v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p className="text-sm">No active sessions</p>
          <p className="text-xs text-fg-subtle/70">Hit “New session” in the top bar to spawn one.</p>
        </div>
      ) : (
        <div className="flex flex-col overflow-y-auto">
          {sessions.map(s => (
            <SessionRow
              key={s.sandbox_id}
              session={s}
              now={now}
              showOwner={isAdmin}
              onTerminate={handleTerminate}
              onShowLogs={setLogsTarget}
            />
          ))}
        </div>
      )}

      {logsTarget && (
        <SessionLogsModal session={logsTarget} onClose={() => setLogsTarget(null)} />
      )}
    </div>
  )
}
