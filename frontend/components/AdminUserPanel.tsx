'use client'

import { useEffect, useRef, useState } from 'react'
import { createUser, deleteUser, fetchUsers, patchUser } from '@/lib/api'
import { SandboxRole, UserRecord } from '@/types'

const SANDBOX_ROLES: { value: SandboxRole; label: string }[] = [
  { value: 'ba', label: 'BA' },
  { value: 'dev', label: 'Dev' },
  { value: 'tester', label: 'Tester' },
  { value: 'devops', label: 'DevOps' },
]

const ROLE_BADGE: Record<SandboxRole, string> = {
  ba:     'bg-blue-500/15 text-blue-400 border-blue-500/20',
  dev:    'bg-accent/15 text-accent border-accent/20',
  tester: 'bg-ok/15 text-ok border-ok/20',
  devops: 'bg-warn/15 text-warn border-warn/20',
}

const ROLE_OPTION_HOVER: Record<SandboxRole, string> = {
  ba:     'hover:bg-blue-500/10 hover:text-blue-400',
  dev:    'hover:bg-accent/10 hover:text-accent',
  tester: 'hover:bg-ok/10 hover:text-ok',
  devops: 'hover:bg-warn/10 hover:text-warn',
}

function RoleSelect({ value, onChange }: { value: SandboxRole | null; onChange: (v: SandboxRole | null) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full border cursor-pointer transition-colors ${
          value
            ? ROLE_BADGE[value]
            : 'bg-raised border-line text-fg-subtle hover:text-fg hover:border-fg-subtle'
        }`}
      >
        {value ? value.toUpperCase() : '— none —'}
        <svg width="8" height="5" viewBox="0 0 8 5" fill="none" className="opacity-60">
          <path d="M1 1L4 4L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-30 bg-surface border border-line rounded-xl shadow-2xl py-1 min-w-[110px]">
          <button
            onClick={() => { onChange(null); setOpen(false) }}
            className={`w-full text-left px-3 py-1.5 text-xs transition-colors cursor-pointer ${
              value === null ? 'text-fg font-medium' : 'text-fg-subtle hover:text-fg hover:bg-raised'
            }`}
          >
            — none —
          </button>
          {SANDBOX_ROLES.map(r => (
            <button
              key={r.value}
              onClick={() => { onChange(r.value); setOpen(false) }}
              className={`w-full text-left px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                value === r.value
                  ? ROLE_BADGE[r.value] + ' rounded-none'
                  : 'text-fg-muted ' + ROLE_OPTION_HOVER[r.value]
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function fmtLimit(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return `${n}`
}

function fmtWindow(m: number): string {
  if (m >= 1440) return `${Math.round(m / 1440)}d`
  if (m >= 60) return `${Math.round(m / 60)}h`
  return `${m}min`
}

const LIMIT_PRESETS = [
  { label: '1K/min',   limit: 1_000,    window: 1 },
  { label: '10K/hr',   limit: 10_000,   window: 60 },
  { label: '100K/day', limit: 100_000,  window: 1440 },
  { label: '∞ Unlimited', limit: null,  window: null },
]

function LimitsModal({ user, onClose, onSaved }: {
  user: UserRecord
  onClose: () => void
  onSaved: () => void
}) {
  const [limit, setLimit]   = useState(user.token_limit?.toString() ?? '')
  const [window_, setWindow] = useState(user.token_limit_window_minutes?.toString() ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const tokenLimit = limit.trim() ? Number(limit) : null
      const windowMin  = window_.trim() ? Number(window_) : null
      await patchUser(user.id, { token_limit: tokenLimit, token_limit_window_minutes: windowMin })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save limits')
      setSaving(false)
    }
  }

  const hasLimit = user.token_limit != null && user.token_limit_window_minutes != null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={handleSave} className="relative w-full max-w-sm bg-surface border border-line rounded-2xl shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="px-5 py-4 border-b border-line">
          <h3 className="text-sm font-semibold text-fg">Token limits</h3>
          <p className="text-xs text-fg-subtle mt-0.5 font-mono truncate">{user.email}</p>
        </div>

        {/* Current state */}
        <div className="px-5 py-3 border-b border-line bg-raised/40">
          {hasLimit ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-warn flex-shrink-0" />
              <span className="text-fg-muted">
                Current limit: <span className="font-mono text-warn font-medium">
                  {fmtLimit(user.token_limit!)} tokens / {fmtWindow(user.token_limit_window_minutes!)}
                </span>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-ok flex-shrink-0" />
              <span className="text-fg-subtle">No limit set — user has unlimited access</span>
            </div>
          )}
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Presets */}
          <div>
            <p className="text-[10px] font-medium text-fg-subtle uppercase tracking-widest mb-2">Quick presets</p>
            <div className="grid grid-cols-4 gap-1.5">
              {LIMIT_PRESETS.map(p => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => { setLimit(p.limit?.toString() ?? ''); setWindow(p.window?.toString() ?? '') }}
                  className="px-2 py-1.5 text-[11px] rounded-lg bg-app border border-line text-fg-muted hover:text-fg hover:border-accent/50 transition-colors cursor-pointer text-center"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Manual inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">
                Token limit <span className="text-fg-subtle font-normal">(empty = ∞)</span>
              </label>
              <input
                value={limit}
                onChange={e => setLimit(e.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
                placeholder="e.g. 10000"
                className="w-full px-3 py-2 text-sm bg-app border border-line rounded-lg text-fg font-mono placeholder:text-fg-subtle placeholder:font-sans focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">
                Window <span className="text-fg-subtle font-normal">(minutes)</span>
              </label>
              <input
                value={window_}
                onChange={e => setWindow(e.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
                placeholder="e.g. 60"
                className="w-full px-3 py-2 text-sm bg-app border border-line rounded-lg text-fg font-mono placeholder:text-fg-subtle placeholder:font-sans focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
              />
            </div>
          </div>

          <p className="text-[11px] text-fg-subtle leading-relaxed">
            Both fields must be set together. Leave both empty to remove the limit.
            The window resets after it expires — usage within the window is tracked via Redis.
          </p>

          {error && (
            <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3.5 border-t border-line">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-fg-muted hover:text-fg rounded-lg hover:bg-raised transition-colors cursor-pointer">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-1.5 text-sm font-semibold bg-accent text-accent-fg rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors cursor-pointer"
          >
            {saving ? 'Saving...' : 'Save limits'}
          </button>
        </div>
      </form>
    </div>
  )
}

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
  const [limitsTarget, setLimitsTarget] = useState<UserRecord | null>(null)

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

  async function handleSandboxRole(u: UserRecord, value: string) {
    try {
      await patchUser(u.id, { sandbox_role: value === '' ? null : value as SandboxRole })
      await loadUsers()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update sandbox role')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in">
      {/* Backdrop */}
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="w-[640px] bg-surface border-l border-line flex flex-col shadow-2xl animate-rise">
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

        {limitsTarget && (
          <LimitsModal
            user={limitsTarget}
            onClose={() => setLimitsTarget(null)}
            onSaved={() => { setLimitsTarget(null); loadUsers() }}
          />
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
                  <th className="px-3 py-2 font-medium">Sandbox role</th>
                  <th className="px-3 py-2 font-medium">Limit</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const hasLimit = u.token_limit != null && u.token_limit_window_minutes != null
                  return (
                    <tr key={u.id} className="border-b border-line/50 hover:bg-raised/40 transition-colors">
                      <td className="px-5 py-3 text-fg truncate max-w-[160px]">{u.email}</td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-accent/15 text-accent' : 'bg-raised text-fg-muted'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <RoleSelect
                          value={u.sandbox_role}
                          onChange={v => handleSandboxRole(u, v ?? '')}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => setLimitsTarget(u)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border cursor-pointer transition-colors ${
                            hasLimit
                              ? 'bg-warn/10 text-warn border-warn/20 hover:bg-warn/20'
                              : 'bg-raised text-fg-subtle border-line hover:border-fg-subtle/40 hover:text-fg'
                          }`}
                          title="Edit token limits"
                        >
                          {hasLimit ? (
                            <>
                              <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2"/><path d="M5 3v2.5L6.5 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                              {fmtLimit(u.token_limit!)}/{fmtWindow(u.token_limit_window_minutes!)}
                            </>
                          ) : '∞'}
                        </button>
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
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
