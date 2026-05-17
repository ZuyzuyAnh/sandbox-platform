import { useState, useEffect } from 'react'
import { fetchActivity } from '@/lib/api'
import { wsBase } from '@/lib/origin'
import { SandboxEvent } from '@/types'

const MAX_EVENTS = 50

export function useEvents() {
  const [events, setEvents] = useState<SandboxEvent[]>([])

  useEffect(() => {
    fetchActivity()
      .then(data => setEvents(data.events))
      .catch(console.error)

    const ws = new WebSocket(`${wsBase()}/api/events`)

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
