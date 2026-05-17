import { useState, useEffect } from 'react'
import { fetchSandboxOutput } from '@/lib/api'
import { OutputLine } from '@/types'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL

export function useSandboxOutput(sandboxId: string | null) {
  const [lines, setLines] = useState<OutputLine[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!sandboxId) {
      setLines([])
      return
    }

    setIsLoading(true)
    setLines([])

    fetchSandboxOutput(sandboxId)
      .then(data => setLines(data.lines))
      .catch(console.error)
      .finally(() => setIsLoading(false))

    const ws = new WebSocket(`${WS_URL}/api/events`)

    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data)
        if (event.sandbox_id !== sandboxId) return
        setLines(prev => [...prev, {
          id: event.id,
          event_type: event.event_type,
          message: event.message,
          timestamp: event.timestamp,
        }])
      } catch {
        // ignore malformed messages
      }
    }

    ws.onerror = (e) => console.error('Output WebSocket error', e)

    return () => ws.close()
  }, [sandboxId])

  return { lines, isLoading }
}
