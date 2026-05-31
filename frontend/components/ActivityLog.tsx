'use client'

import { useEffect, useRef } from 'react'
import { useEvents } from '@/hooks/useEvents'
import { EventType, SandboxEvent } from '@/types'

function relativeTime(timestamp: string): string {
  const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000)
  if (diff < 10) return 'just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

const EVENT_STYLES: Record<EventType, { icon: string; color: string }> = {
  started:   { icon: '▶', color: 'text-blue-500' },
  output:    { icon: '⬛', color: 'text-gray-400' },
  completed: { icon: '✓', color: 'text-emerald-500' },
  error:     { icon: '✕', color: 'text-red-500' },
  timeout:   { icon: '⚠', color: 'text-amber-500' },
  thought:   { icon: '💭', color: 'text-gray-400' },
  tool_use:       { icon: '🔧', color: 'text-amber-500' },
  code:           { icon: '»', color: 'text-green-500' },
  policy_changed: { icon: '🛡', color: 'text-purple-500' },
}

function EventRow({ event }: { event: SandboxEvent }) {
  const style = EVENT_STYLES[event.event_type] ?? EVENT_STYLES.output
  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
      <span className={`mt-0.5 text-sm w-4 flex-shrink-0 ${style.color}`}>{style.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 truncate">
          <span className="font-medium">{event.sandbox_id}</span>
          {event.message ? ` — ${event.message}` : ''}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {event.agent || 'Unknown'} · {relativeTime(event.timestamp)}
        </p>
      </div>
    </div>
  )
}

export default function ActivityLog() {
  const { events } = useEvents()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-sm font-semibold text-gray-700 mb-2">Activity log</h2>
      <div className="flex-1 overflow-y-auto">
        {events.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            No events yet
          </div>
        ) : (
          events.map(event => <EventRow key={event.id} event={event} />)
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
