'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useSessionLogs } from '@/hooks/useSessionLogs'
import { Session } from '@/types'

type InstallStatus = 'installing' | 'ok' | 'failed' | 'unknown'

function installStatus(lines: { line: string }[]): InstallStatus {
  let status: InstallStatus = 'unknown'
  for (const l of lines) {
    if (l.line.includes('Claude Code install OK')) status = 'ok'
    else if (l.line.includes('Claude Code install FAILED')) status = 'failed'
    else if (l.line.includes('Installing Claude Code')) {
      if (status === 'unknown') status = 'installing'
    }
  }
  return status
}

const STATUS_UI: Record<InstallStatus, { label: string; cls: string; dot: string }> = {
  installing: { label: 'Installing Claude Code...', cls: 'bg-warn/15 text-warn', dot: 'bg-warn animate-pulse-dot' },
  ok: { label: 'Claude Code ready', cls: 'bg-ok/15 text-ok', dot: 'bg-ok' },
  failed: { label: 'Claude Code install failed', cls: 'bg-danger/15 text-danger', dot: 'bg-danger' },
  unknown: { label: 'Waiting for logs...', cls: 'bg-raised text-fg-subtle', dot: 'bg-fg-subtle animate-pulse-dot' },
}

export default function SessionLogsModal({ session, onClose }: { session: Session; onClose: () => void }) {
  const { filteredLines, lines, search, setSearch } = useSessionLogs(session.sandbox_id)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const status = useMemo(() => installStatus(lines), [lines])
  const statusUi = STATUS_UI[status]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [filteredLines.length])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl h-[70vh] bg-surface border border-line rounded-2xl shadow-2xl animate-scale-in flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-line flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold font-display text-fg">Session logs</h2>
            <p className="text-[11px] font-mono text-fg-subtle truncate">{session.sandbox_id}</p>
          </div>

          <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${statusUi.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusUi.dot}`} />
            {statusUi.label}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle" width="11" height="11" viewBox="0 0 14 14" fill="none">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" /><path d="M10 10l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filter logs..."
                className="w-44 pl-7 pr-2.5 py-1.5 rounded-lg bg-app border border-line text-fg text-xs placeholder:text-fg-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
              />
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-fg-subtle hover:text-fg hover:bg-raised transition-colors cursor-pointer"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
          </div>
        </div>

        {/* Log body */}
        <div className="flex-1 overflow-y-auto bg-app/60 px-4 py-3 font-mono text-[12px] leading-relaxed">
          {filteredLines.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-fg-subtle">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="opacity-40 animate-pulse">
                <path d="M4 17l5-5-5-5M11 19h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="text-xs">{lines.length === 0 ? 'Waiting for log output...' : 'No lines match your filter.'}</p>
            </div>
          ) : (
            filteredLines.map((l, i) => {
              const isMarker = l.line.includes('===')
              const isError = /error|failed/i.test(l.line) && !l.line.includes('install OK')
              return (
                <p
                  key={i}
                  className={`whitespace-pre-wrap break-all ${
                    isMarker ? 'text-accent font-semibold' : isError ? 'text-danger' : 'text-fg-muted'
                  }`}
                >
                  {l.line}
                </p>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-line bg-raised/30 flex-shrink-0">
          <span className="text-[11px] text-fg-subtle">
            {filteredLines.length.toLocaleString()} line{filteredLines.length !== 1 ? 's' : ''} · streaming live
          </span>
          <a
            href={session.session_url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-accent text-accent-fg hover:bg-accent-hover active:scale-[0.97] transition-all"
          >
            Open VS Code
          </a>
        </div>
      </div>
    </div>
  )
}
