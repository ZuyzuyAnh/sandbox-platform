'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { createUser, deleteUser, fetchUsers } from '@/lib/api'
import { SandboxRole, UserRecord } from '@/types'

const ROLE_BADGE: Record<SandboxRole, string> = {
  ba:     'bg-blue-500/15 text-blue-400',
  dev:    'bg-accent/15 text-accent',
  tester: 'bg-ok/15 text-ok',
  devops: 'bg-warn/15 text-warn',
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

// ── Create user modal ──────────────────────────────────────────────────────────

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'user' | 'admin'>('user')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await createUser(email, password, role)
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={handleCreate} className="relative w-full max-w-md bg-surface border border-line rounded-2xl shadow-2xl animate-scale-in">
        <div className="px-6 py-4 border-b border-line">
          <h2 className="text-base font-semibold font-display text-fg">Create user</h2>
          <p className="text-xs text-fg-subtle mt-0.5">New users join the default group automatically.</p>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="user@example.com"
                className="w-full px-3 py-2.5 text-sm bg-app border border-line rounded-lg text-fg placeholder:text-fg-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
              />
            </div>
            <div className="w-28">
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Role</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as 'user' | 'admin')}
                className="w-full px-2 py-2.5 text-sm bg-app border border-line rounded-lg text-fg focus:outline-none focus:border-accent transition-colors"
              >
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="Initial password"
              className="w-full px-3 py-2.5 text-sm bg-app border border-line rounded-lg text-fg placeholder:text-fg-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            />
          </div>
          {error && (
            <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-line">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-fg-muted hover:text-fg hover:bg-raised transition-colors cursor-pointer">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-accent text-accent-fg hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50 transition-all cursor-pointer"
          >
            {saving ? 'Creating...' : 'Create user'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 5

export default function UsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)

  async function load() {
    try {
      setUsers(await fetchUsers())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { setPage(1) }, [search])

  async function handleDelete(u: UserRecord) {
    if (!confirm(`Delete user "${u.email}"?`)) return
    try {
      await deleteUser(u.id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete user')
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return users.filter(u => u.email.toLowerCase().includes(q))
  }, [users, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const stats = useMemo(() => ({
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    active: users.filter(u => u.is_active).length,
  }), [users])

  return (
    <div className="max-w-5xl mx-auto p-6 animate-rise">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold font-display tracking-tight mb-1">Users</h1>
          <p className="text-sm text-fg-subtle">Click a user to open their dashboard — configure access, rate limits and guardrails there.</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-fg text-sm font-semibold hover:bg-accent-hover active:scale-[0.98] transition-all cursor-pointer"
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          Create user
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total users', value: stats.total, tone: 'text-fg' },
          { label: 'Admins', value: stats.admins, tone: 'text-accent' },
          { label: 'Active', value: stats.active, tone: 'text-ok' },
        ].map(({ label, value, tone }, i) => (
          <div key={label} className="bg-surface border border-line rounded-xl p-4 animate-rise" style={{ animationDelay: `${i * 50}ms` }}>
            <p className="text-[10px] font-medium text-fg-subtle uppercase tracking-widest mb-1">{label}</p>
            <p className={`text-2xl font-bold font-mono ${tone}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar: search + pagination */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative max-w-xs flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" width="13" height="13" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" /><path d="M10 10l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by email..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface border border-line text-fg text-sm placeholder:text-fg-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
          />
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="w-7 h-7 flex items-center justify-center rounded-md text-fg-subtle hover:text-fg hover:bg-raised disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-default"
            aria-label="Previous page"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M7.5 2L3.5 6L7.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-7 h-7 flex items-center justify-center rounded-md text-xs font-medium transition-colors cursor-pointer ${
                p === safePage ? 'bg-accent text-accent-fg' : 'text-fg-subtle hover:text-fg hover:bg-raised'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="w-7 h-7 flex items-center justify-center rounded-md text-fg-subtle hover:text-fg hover:bg-raised disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-default"
            aria-label="Next page"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 2L8.5 6L4.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-4 text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Table */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-4 flex flex-col gap-3">
              {[0, 1, 2].map(i => <div key={i} className="h-12 skeleton rounded-lg" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-fg-subtle">
              {users.length === 0 ? 'No users yet.' : 'No users match your search.'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-raised/40">
                  {['User', 'Role', 'Sandbox role', 'Limit', 'Status', 'Groups', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-fg-subtle whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map(u => {
                  const hasLimit = u.token_limit != null && u.token_limit_window_minutes != null
                  return (
                    <tr
                      key={u.id}
                      onClick={() => router.push(`/admin/users/${u.id}`)}
                      className="border-b border-line/50 last:border-0 hover:bg-raised/40 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-lg bg-accent/15 border border-accent/20 flex items-center justify-center text-accent font-semibold text-xs flex-shrink-0">
                            {u.email.charAt(0).toUpperCase()}
                          </span>
                          <span className="text-fg font-medium truncate max-w-[180px] group-hover:text-accent transition-colors">{u.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-accent/15 text-accent' : 'bg-raised text-fg-muted'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {u.sandbox_role ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[u.sandbox_role]}`}>
                            {u.sandbox_role.toUpperCase()}
                          </span>
                        ) : (
                          <span className="text-xs text-fg-subtle">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {hasLimit ? (
                          <span className="font-mono text-xs text-warn">{fmtLimit(u.token_limit!)}/{fmtWindow(u.token_limit_window_minutes!)}</span>
                        ) : (
                          <span className="text-xs text-fg-subtle">∞</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${u.is_active ? 'bg-ok/15 text-ok' : 'bg-danger/15 text-danger'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-ok' : 'bg-danger'}`} />
                          {u.is_active ? 'active' : 'disabled'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-fg-subtle truncate max-w-[120px]">
                        {u.groups.length > 0 ? u.groups.join(', ') : '—'}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-xs text-fg-subtle group-hover:text-accent transition-colors mr-3">
                          Open
                          <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M4.5 2L8.5 6L4.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </span>
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(u) }}
                          aria-label={`Delete ${u.email}`}
                          className="text-fg-subtle/60 hover:text-danger transition-colors cursor-pointer align-middle"
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

      {!loading && filtered.length > 0 && (
        <p className="mt-3 text-xs text-fg-subtle">
          {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} users
        </p>
      )}

      {createOpen && (
        <CreateUserModal onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); load() }} />
      )}
    </div>
  )
}
