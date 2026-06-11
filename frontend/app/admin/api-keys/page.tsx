'use client'

import { useEffect, useMemo, useState } from 'react'
import { createVirtualKey, fetchUsers, fetchVirtualKeys, revokeVirtualKey } from '@/lib/api'
import type { VirtualKey, VirtualKeyCreated } from '@/types'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── Create modal ─────────────────────────────────────────────────────────────

function CreateKeyModal({ onClose, onCreated }: { onClose: () => void; onCreated: (k: VirtualKeyCreated) => void }) {
  const [label, setLabel] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError(null)
    try {
      const created = await createVirtualKey(label.trim() || null)
      onCreated(created)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create key')
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={handleCreate} className="relative w-full max-w-md bg-surface border border-line rounded-2xl shadow-2xl animate-scale-in">
        <div className="px-6 py-4 border-b border-line">
          <h2 className="text-base font-semibold font-display text-fg">Create virtual key</h2>
          <p className="text-xs text-fg-subtle mt-0.5">Used by Claude Code inside sandboxes to reach the gateway.</p>
        </div>

        <div className="px-6 py-5">
          <label htmlFor="label" className="block text-xs font-medium text-fg-muted mb-1.5">Label <span className="text-fg-subtle">(optional)</span></label>
          <input
            id="label"
            value={label}
            onChange={e => setLabel(e.target.value)}
            autoFocus
            placeholder="e.g. CI pipeline"
            className="w-full px-3 py-2.5 rounded-lg bg-app border border-line text-fg text-sm placeholder:text-fg-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
          />
          {error && (
            <p role="alert" className="mt-3 text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-line">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-fg-muted hover:text-fg hover:bg-raised transition-colors cursor-pointer">
            Cancel
          </button>
          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-accent text-accent-fg hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50 transition-all cursor-pointer"
          >
            {creating ? 'Creating...' : 'Create key'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Show-once key modal ──────────────────────────────────────────────────────

function KeyCreatedModal({ created, onClose }: { created: VirtualKeyCreated; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(created.key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg bg-surface border border-line rounded-2xl shadow-2xl animate-scale-in">
        <div className="px-6 py-5 text-center border-b border-line">
          <div className="w-11 h-11 rounded-full bg-ok/15 flex items-center justify-center mx-auto mb-3">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 10.5L8 14.5 16 6" stroke="rgb(var(--ok))" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <h2 className="text-base font-semibold font-display text-fg">Key created</h2>
          <p className="text-xs text-fg-subtle mt-1">
            {created.label ? <>Label: <span className="text-fg-muted">{created.label}</span> · </> : null}
            Copy it now. <span className="text-warn font-medium">It will not be shown again.</span>
          </p>
        </div>

        <div className="px-6 py-5">
          <div className="flex items-center gap-2 bg-app border border-line rounded-lg p-3">
            <code className="flex-1 font-mono text-xs text-fg break-all select-all">{created.key}</code>
            <button
              onClick={copy}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex-shrink-0 ${
                copied ? 'bg-ok/15 text-ok' : 'bg-accent text-accent-fg hover:bg-accent-hover active:scale-[0.97]'
              }`}
            >
              {copied ? (
                <>
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6.5L4.5 9 10 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Copied
                </>
              ) : (
                <>
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><rect x="4" y="4" width="6.5" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" /><path d="M1.5 8.5v-6a1 1 0 0 1 1-1h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
                  Copy
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-line">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-fg-muted hover:text-fg hover:bg-raised transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Revoke confirm ───────────────────────────────────────────────────────────

function RevokeConfirm({ vk, onConfirm, onCancel }: { vk: VirtualKey; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-surface border border-line rounded-2xl shadow-2xl animate-scale-in p-6 text-center">
        <div className="w-11 h-11 rounded-full bg-danger/15 flex items-center justify-center mx-auto mb-4">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 5.5V10M9 12.5v.5" stroke="rgb(var(--danger))" strokeWidth="1.6" strokeLinecap="round" /><circle cx="9" cy="9" r="7" stroke="rgb(var(--danger))" strokeWidth="1.5" /></svg>
        </div>
        <h3 className="text-base font-semibold font-display text-fg mb-2">Revoke key</h3>
        <p className="text-sm text-fg-subtle mb-6">
          <span className="font-mono text-fg-muted">{vk.key_prefix}...</span>
          {vk.label ? <> ({vk.label})</> : null} will stop working immediately. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2 rounded-lg text-sm text-fg-muted border border-line hover:bg-raised transition-colors cursor-pointer">
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-danger text-white hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer">
            Revoke
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<VirtualKey[]>([])
  const [emailByUserId, setEmailByUserId] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'revoked'>('all')

  const [createOpen, setCreateOpen] = useState(false)
  const [justCreated, setJustCreated] = useState<VirtualKeyCreated | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<VirtualKey | null>(null)

  async function load() {
    try {
      const [keyList, users] = await Promise.all([
        fetchVirtualKeys(),
        fetchUsers().catch(() => []),
      ])
      setKeys(keyList)
      setEmailByUserId(Object.fromEntries(users.map(u => [u.id, u.email])))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load keys')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return keys.filter(k => {
      const owner = emailByUserId[k.user_id] ?? k.user_id
      const matchSearch =
        (k.label ?? '').toLowerCase().includes(q) ||
        k.key_prefix.toLowerCase().includes(q) ||
        owner.toLowerCase().includes(q)
      const matchFilter = filter === 'all' || (filter === 'active' ? k.is_active : !k.is_active)
      return matchSearch && matchFilter
    })
  }, [keys, search, filter, emailByUserId])

  const stats = useMemo(() => ({
    total: keys.length,
    active: keys.filter(k => k.is_active).length,
    revoked: keys.filter(k => !k.is_active).length,
  }), [keys])

  async function handleRevoke(vk: VirtualKey) {
    try {
      await revokeVirtualKey(vk.id)
      setRevokeTarget(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to revoke key')
      setRevokeTarget(null)
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 animate-rise">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold font-display tracking-tight mb-1">Virtual API keys</h1>
          <p className="text-sm text-fg-subtle">Per-user keys that authenticate sandbox traffic to the LLM gateway.</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-fg text-sm font-semibold hover:bg-accent-hover active:scale-[0.98] transition-all cursor-pointer"
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          Create key
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total keys', value: stats.total, tone: 'text-fg' },
          { label: 'Active', value: stats.active, tone: 'text-ok' },
          { label: 'Revoked', value: stats.revoked, tone: 'text-fg-subtle' },
        ].map(({ label, value, tone }, i) => (
          <div key={label} className="bg-surface border border-line rounded-xl p-4 animate-rise" style={{ animationDelay: `${i * 50}ms` }}>
            <p className="text-[10px] font-medium text-fg-subtle uppercase tracking-widest mb-1">{label}</p>
            <p className={`text-2xl font-bold font-mono ${tone}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative max-w-xs flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" width="13" height="13" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" /><path d="M10 10l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search label, prefix, owner..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface border border-line text-fg text-sm placeholder:text-fg-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
          />
        </div>
        <div className="flex gap-1 bg-surface border border-line rounded-lg p-1">
          {(['all', 'active', 'revoked'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors cursor-pointer ${
                filter === f ? 'bg-raised text-fg' : 'text-fg-subtle hover:text-fg-muted'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-4 text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Table */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-4 flex flex-col gap-3">
            {[0, 1, 2].map(i => <div key={i} className="h-10 skeleton rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-fg-subtle">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="opacity-40">
              <circle cx="12" cy="14" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M17.5 18.5L28 28M24.5 24.5l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <p className="text-sm">{keys.length === 0 ? 'No keys yet. Create the first one.' : 'No keys match your search.'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-raised/40">
                {['Label', 'Key', 'Owner', 'Status', 'Created', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-fg-subtle whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((k, i) => (
                <tr key={k.id} className="border-b border-line/50 last:border-0 hover:bg-raised/40 transition-colors animate-fade-in" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
                  <td className="px-4 py-3 text-fg text-sm font-medium">{k.label ?? <span className="text-fg-subtle font-normal">Untitled</span>}</td>
                  <td className="px-4 py-3 font-mono text-xs text-fg-muted">{k.key_prefix}...</td>
                  <td className="px-4 py-3 text-xs text-fg-muted">{emailByUserId[k.user_id] ?? <span className="font-mono">{k.user_id.slice(0, 8)}</span>}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      k.is_active ? 'bg-ok/15 text-ok' : 'bg-raised text-fg-subtle'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${k.is_active ? 'bg-ok' : 'bg-fg-subtle'}`} />
                      {k.is_active ? 'Active' : 'Revoked'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-fg-subtle whitespace-nowrap" title={new Date(k.created_at).toLocaleString()}>
                    {timeAgo(k.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {k.is_active && (
                      <button
                        onClick={() => setRevokeTarget(k)}
                        className="px-2.5 py-1 text-xs font-medium rounded-md text-fg-subtle hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <p className="mt-3 text-xs text-fg-subtle">{filtered.length} of {keys.length} keys shown</p>
      )}

      {/* Modals */}
      {createOpen && (
        <CreateKeyModal
          onClose={() => setCreateOpen(false)}
          onCreated={k => { setCreateOpen(false); setJustCreated(k); load() }}
        />
      )}
      {justCreated && (
        <KeyCreatedModal created={justCreated} onClose={() => setJustCreated(null)} />
      )}
      {revokeTarget && (
        <RevokeConfirm vk={revokeTarget} onConfirm={() => handleRevoke(revokeTarget)} onCancel={() => setRevokeTarget(null)} />
      )}
    </div>
  )
}
