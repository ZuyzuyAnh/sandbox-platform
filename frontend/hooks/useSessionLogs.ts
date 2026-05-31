import { useState, useEffect, useRef } from 'react'
import { sessionLogsStreamUrl } from '@/lib/api'
import { LogLine } from '@/types'

const MAX_LINES = 2000

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('auth_token')
}

export function useSessionLogs(sandboxId: string | null) {
  const [lines, setLines] = useState<LogLine[]>([])
  const [search, setSearch] = useState('')
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
    setLines([])

    if (!sandboxId) return

    const token = getToken()
    if (!token) return

    const es = new EventSource(sessionLogsStreamUrl(sandboxId, token))
    esRef.current = es

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.error) return
        const logLine: LogLine = { line: data.line, ts: data.ts }
        setLines(prev => {
          const next = [...prev, logLine]
          return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next
        })
      } catch {
        // ignore malformed events
      }
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [sandboxId])

  const clearLogs = () => setLines([])

  const filteredLines = search
    ? lines.filter(l => l.line.toLowerCase().includes(search.toLowerCase()))
    : lines

  return { lines, filteredLines, search, setSearch, clearLogs }
}
