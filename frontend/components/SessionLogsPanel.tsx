'use client'

import { useState, useEffect, useRef } from 'react'
import { useSessions } from '@/hooks/useSessions'
import { useSessionLogs } from '@/hooks/useSessionLogs'

function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  } catch {
    return ''
  }
}

export default function SessionLogsPanel() {
  const { sessions } = useSessions()
  const activeSessions = sessions.filter(s => s.status === 'active')

  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Auto-select the first active session when sessions load
  useEffect(() => {
    if (selectedId === null && activeSessions.length > 0) {
      setSelectedId(activeSessions[0].sandbox_id)
    }
    // If selected session disappears, reset
    if (selectedId && !activeSessions.find(s => s.sandbox_id === selectedId)) {
      setSelectedId(activeSessions.length > 0 ? activeSessions[0].sandbox_id : null)
    }
  }, [activeSessions, selectedId])

  const { filteredLines, search, setSearch, clearLogs } = useSessionLogs(selectedId)

  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [filteredLines, autoScroll])

  function handleScroll() {
    const el = containerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    setAutoScroll(atBottom)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 gap-2 flex-shrink-0">
        <span className="text-sm font-semibold text-gray-700">Session logs</span>
        <div className="flex items-center gap-2">
          <select
            value={selectedId ?? ''}
            onChange={e => { setSelectedId(e.target.value || null); clearLogs() }}
            className="text-xs border border-gray-200 rounded-md px-2 py-1 text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            {activeSessions.length === 0 && (
              <option value="">No active sessions</option>
            )}
            {activeSessions.map(s => (
              <option key={s.sandbox_id} value={s.sandbox_id}>
                {s.sandbox_id.slice(0, 8)}…
              </option>
            ))}
          </select>
          <button
            onClick={clearLogs}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-1"
            title="Clear logs"
          >
            × Clear
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2 mb-2 flex-shrink-0">
        <div className="flex-1 flex items-center gap-1.5 border border-gray-200 rounded-md px-2 py-1 focus-within:ring-1 focus-within:ring-blue-400">
          <span className="text-gray-400 text-xs">🔍</span>
          <input
            type="text"
            placeholder="Search logs…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 text-xs outline-none text-gray-700 placeholder-gray-400 bg-transparent"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 text-xs">×</button>
          )}
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0">{filteredLines.length} lines</span>
      </div>

      {/* Log lines */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto font-mono text-xs"
      >
        {activeSessions.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-gray-400">
            No active sessions
          </div>
        ) : filteredLines.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-gray-400">
            {search ? 'No matching lines' : 'Waiting for logs…'}
          </div>
        ) : (
          filteredLines.map((l, i) => (
            <div
              key={i}
              className={`flex gap-2 px-1 py-0.5 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
            >
              <span className="text-gray-400 flex-shrink-0 select-none">{formatTime(l.ts)}</span>
              <span className="text-gray-800 break-all whitespace-pre-wrap">{l.line}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
