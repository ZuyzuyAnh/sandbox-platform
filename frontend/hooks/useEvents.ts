import { useState, useEffect } from 'react'
import { fetchActivity } from '@/lib/api'
import { SandboxEvent } from '@/types'

const MAX_EVENTS = 50
const WS_URL = process.env.NEXT_PUBLIC_WS_URL

export function useEvents() {
  const [events, setEvents] = useState<SandboxEvent[]>([])

  useEffect(() => {
    fetchActivity()
      .then(data => setEvents(data.events))
      .catch(console.error)

    const ws = new WebSocket(`${WS_URL}/api/events`)

    ws.onmessage = (e) => {
      try {
        const event: SandboxEvent = JSON.parse(e.data)
        setEvents(prev => {
          const updated = [...prev, event]
          return updated.slice(-MAX_EVENTS)
        })
      } catch {
        // ignore malformed messages
      }
    }

    ws.onerror = (e) => console.error('WebSocket error', e)

    return () => {
      ws.close()
    }
  }, [])

  return { events }
}
