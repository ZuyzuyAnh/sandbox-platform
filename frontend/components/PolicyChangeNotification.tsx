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
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4">
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 shadow-md">
        <span className="text-amber-500 text-lg flex-shrink-0">⚠</span>
        <p className="flex-1 text-sm text-amber-800">
          Your session was reset due to a network policy change. Please create a new session to continue.
        </p>
        <button
          onClick={() => setVisible(false)}
          className="text-amber-400 hover:text-amber-600 text-lg leading-none flex-shrink-0"
        >
          ×
        </button>
      </div>
    </div>
  )
}
