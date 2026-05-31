import { useState, useEffect } from 'react'
import { fetchActivity } from '@/lib/api'
import { wsBase } from '@/lib/origin'
import { SandboxEvent } from '@/types'

const MAX_EVENTS = 50

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('auth_token')
}

export function useEvents() {
  const [events, setEvents] = useState<SandboxEvent[]>([])

  useEffect(() => {
    fetchActivity()
      .then(data => setEvents(data.events))
      .catch(console.error)

    const token = getToken()
    const url = token ? `${wsBase()}/api/events?token=${encodeURIComponent(token)}` : null
    if (!url) return

    const ws = new WebSocket(url)

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
