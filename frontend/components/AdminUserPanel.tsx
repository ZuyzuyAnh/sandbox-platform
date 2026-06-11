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
    <div className="fixed inset-0 z-50 flex animate-fade-in">
      {/* Backdrop */}
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="w-[560px] bg-surface border-l border-line flex flex-col shadow-2xl animate-rise">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line flex-shrink-0">
          <h2 className="text-base font-semibold font-display text-fg">Users</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowForm(v => !v)}
              className="px-3 py-1.5 text-xs font-semibold bg-accent text-accent-fg rounded-lg hover:bg-accent-hover transition-colors cursor-pointer"
            >
              {showForm ? 'Cancel' : '+ New user'}
            </button>
            <button onClick={onClose} aria-label="Close" className="text-fg-subtle hover:text-fg text-lg cursor-pointer">✕</button>
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-3 text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* New user form */}
        {showForm && (
          <form onSubmit={handleCreate} className="px-5 py-4 border-b border-line bg-raised/50 flex flex-col gap-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-fg-muted mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-3 py-1.5 text-sm bg-app border border-line rounded-lg text-fg placeholder:text-fg-subtle focus:outline-none focus:border-accent transition-colors"
                  placeholder="user@example.com"
                />
              </div>
              <div className="w-28">
                <label className="block text-xs font-medium text-fg-muted mb-1">Role</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as 'user' | 'admin')}
                  className="w-full px-2 py-1.5 text-sm bg-app border border-line rounded-lg text-fg focus:outline-none focus:border-accent transition-colors"
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-3 py-1.5 text-sm bg-app border border-line rounded-lg text-fg placeholder:text-fg-subtle focus:outline-none focus:border-accent transition-colors"
                placeholder="Initial password"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="self-start px-4 py-1.5 text-sm font-medium bg-accent text-accent-fg rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors cursor-pointer"
            >
              {saving ? 'Creating...' : 'Create user'}
            </button>
          </form>
        )}

        {/* User list */}
        <div className="flex-1 overflow-y-auto">
          {users.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-fg-subtle">No users</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-fg-subtle border-b border-line bg-raised/50">
                  <th className="px-5 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Groups</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 w-16" />
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-line/50 hover:bg-raised/40 transition-colors">
                    <td className="px-5 py-3 text-fg truncate max-w-[180px]">{u.email}</td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-accent/15 text-accent' : 'bg-raised text-fg-muted'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-fg-subtle max-w-[120px] truncate">
                      {u.groups.join(', ') || '-'}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => handleToggleActive(u)}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${u.is_active ? 'bg-ok/15 text-ok hover:bg-danger/15 hover:text-danger' : 'bg-danger/15 text-danger hover:bg-ok/15 hover:text-ok'}`}
                      >
                        {u.is_active ? 'active' : 'disabled'}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => handleDelete(u)}
                        aria-label={`Delete ${u.email}`}
                        className="text-fg-subtle/60 hover:text-danger transition-colors cursor-pointer"
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
