'use client'

import { useEffect, useState } from 'react'
import { createUser, deleteUser, fetchUsers, patchUser } from '@/lib/api'
import { UserRecord } from '@/types'

interface Props {
  onClose: () => void
}

export default function AdminUserPanel({ onClose }: Props) {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'user' | 'admin'>('user')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function loadUsers() {
    try {
      setUsers(await fetchUsers())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users')
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await createUser(email, password, role)
      setEmail('')
      setPassword('')
      setRole('user')
      setShowForm(false)
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(u: UserRecord) {
    if (!confirm(`Delete user "${u.email}"?`)) return
    try {
      await deleteUser(u.id)
      await loadUsers()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete user')
    }
  }

  async function handleToggleActive(u: UserRecord) {
    try {
      await patchUser(u.id, { is_active: !u.is_active })
      await loadUsers()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update user')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="w-[560px] bg-white border-l border-gray-200 flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Users</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowForm(v => !v)}
              className="px-3 py-1.5 text-xs font-medium bg-violet-600 text-white rounded-md hover:bg-violet-700 transition-colors"
            >
              {showForm ? 'Cancel' : '+ New user'}
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </div>
        )}

        {/* New user form */}
        {showForm && (
          <form onSubmit={handleCreate} className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex flex-col gap-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-violet-500"
                  placeholder="user@example.com"
                />
              </div>
              <div className="w-28">
                <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as 'user' | 'admin')}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-violet-500"
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-violet-500"
                placeholder="Initial password"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="self-start px-4 py-1.5 text-sm bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Creating…' : 'Create user'}
            </button>
          </form>
        )}

        {/* User list */}
        <div className="flex-1 overflow-y-auto">
          {users.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-gray-400">No users</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Groups</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 w-16" />
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-800 truncate max-w-[180px]">{u.email}</td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-600'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500 max-w-[120px] truncate">
                      {u.groups.join(', ') || '—'}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => handleToggleActive(u)}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-red-100 hover:text-red-700' : 'bg-red-100 text-red-700 hover:bg-emerald-100 hover:text-emerald-700'} transition-colors`}
                      >
                        {u.is_active ? 'active' : 'disabled'}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => handleDelete(u)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
