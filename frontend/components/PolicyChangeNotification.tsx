'use client'

import { useEffect, useState } from 'react'
import { useEvents } from '@/hooks/useEvents'
import { useSessions } from '@/hooks/useSessions'

export default function PolicyChangeNotification() {
  const { events } = useEvents()
  const { mutate } = useSessions()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const latest = events[events.length - 1]
    if (latest?.event_type === 'policy_changed') {
      setVisible(true)
      mutate()
      const t = setTimeout(() => setVisible(false), 10000)
      return () => clearTimeout(t)
    }
  }, [events, mutate])

  if (!visible) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4 animate-rise">
      <div className="flex items-start gap-3 bg-surface border border-warn/40 rounded-xl px-4 py-3 shadow-2xl" role="alert" aria-live="polite">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="flex-shrink-0 mt-0.5 text-warn">
          <path d="M9 2L16.5 15H1.5L9 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M9 7v3.5M9 12.7v.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <p className="flex-1 text-sm text-fg-muted">
          Your session was reset due to a network policy change. Please create a new session to continue.
        </p>
        <button
          onClick={() => setVisible(false)}
          aria-label="Dismiss"
          className="text-fg-subtle hover:text-fg text-lg leading-none flex-shrink-0 cursor-pointer"
        >
          ×
        </button>
      </div>
    </div>
  )
}
