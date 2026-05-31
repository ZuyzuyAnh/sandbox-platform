'use client'

import { useState } from 'react'
import { terminateSession } from '@/lib/api'
import { useSessions } from '@/hooks/useSessions'

function formatExpiry(expiresAt: string): string {
  const diff = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
  if (diff <= 0) return 'Expired'
  const m = Math.floor(diff / 60)
  const s = diff % 60
  return `${m}m ${s < 10 ? '0' : ''}${s}s`
}

export default function AdminUsersOnline() {
  const { sessions, isLoading, mutate } = useSessions()
  const [terminating, setTerminating] = useState<Set<string>>(new Set())

  if (isLoading || sessions.length === 0) return null

  // Group sessions by user_email
  const byUser = sessions.reduce<Record<string, typeof sessions>>((acc, s) => {
    const key = s.user_email ?? 'Unknown'
    acc[key] = acc[key] ?? []
    acc[key].push(s)
    return acc
  }, {})

  async function terminateAll(email: string) {
    const ids = (byUser[email] ?? []).map(s => s.sandbox_id)
    setTerminating(prev => new Set([...prev, ...ids]))
    try {
      await Promise.all(ids.map(id => terminateSession(id)))
      await mutate()
    } finally {
      setTerminating(prev => {
        const next = new Set(prev)
        ids.forEach(id => next.delete(id))
        return next
      })
    }
  }

  return (
    <div className="flex flex-col">
      <h2 className="text-sm font-semibold text-gray-700 mb-2">
        Users online
        <span className="ml-2 text-xs font-normal text-gray-400">({Object.keys(byUser).length})</span>
      </h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
            <th className="pb-1 font-medium">User</th>
            <th className="pb-1 font-medium">Sessions</th>
            <th className="pb-1 font-medium">Expires</th>
            <th className="pb-1 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(byUser).map(([email, userSessions]) => {
            const earliest = userSessions.reduce((a, b) =>
              new Date(a.expires_at) < new Date(b.expires_at) ? a : b
            )
            const anyTerminating = userSessions.some(s => terminating.has(s.sandbox_id))
            return (
              <tr key={email} className="border-b border-gray-100 last:border-0">
                <td className="py-2 pr-4 text-xs text-gray-700">{email}</td>
                <td className="py-2 pr-4 text-xs text-gray-500">{userSessions.length}</td>
                <td className="py-2 pr-4 text-xs text-gray-500">{formatExpiry(earliest.expires_at)}</td>
                <td className="py-2">
                  <button
                    onClick={() => terminateAll(email)}
                    disabled={anyTerminating}
                    className="px-3 py-1 text-xs rounded-md bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-700 disabled:opacity-50 transition-colors"
                  >
                    {anyTerminating ? '…' : 'Terminate all'}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
