/**
 * API / WebSocket base URLs.
 *
 * When NEXT_PUBLIC_* are unset, use the browser origin (same host as nginx).
 * That avoids CORS and works for both http and https without rebuilding.
 */
export function apiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  if (typeof window !== 'undefined') return window.location.origin
  return 'http://localhost:8000'
}

export function wsBase(): string {
  const configured = process.env.NEXT_PUBLIC_WS_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}`
  }
  return 'ws://localhost:8000'
}
