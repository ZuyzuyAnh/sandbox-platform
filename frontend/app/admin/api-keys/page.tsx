'use client'

import { useState, useMemo } from 'react'
import { MOCK_VIRTUAL_KEYS, AVAILABLE_MODELS } from '@/lib/mock-ai-data'
import type { VirtualApiKey } from '@/types'

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function usagePercent(key: VirtualApiKey) {
  if (!key.token_limit) return null
  return Math.min(100, (key.tokens_used / key.token_limit) * 100)
}

function timeAgo(iso: string | null) {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── Sub-components ───────────────────────────────────────────────────────────

function UsageBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#22C55E'
  return (
    <div className="w-full h-1.5 rounded-full bg-[#334155] overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  )
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
      active ? 'bg-[rgba(34,197,94,0.15)] text-[#22C55E]' : 'bg-[rgba(148,163,184,0.1)] text-[#64748B]'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-[#22C55E]' : 'bg-[#64748B]'}`} />
      {active ? 'Active' : 'Disabled'}
    </span>
  )
}

function ModelTag({ model }: { model: string }) {
  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#1E293B] border border-[#334155] text-[#94A3B8]">
      {model}
    </span>
  )
}

// ── Create/Edit Modal ────────────────────────────────────────────────────────

interface ModalProps {
  initial?: VirtualApiKey | null
  onClose: () => void
  onSave: (data: Partial<VirtualApiKey>) => void
}

function KeyModal({ initial, onClose, onSave }: ModalProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [userEmail, setUserEmail] = useState(initial?.user_email ?? '')
  const [selectedModels, setSelectedModels] = useState<string[]>(initial?.model_access ?? [])
  const [tokenLimit, setTokenLimit] = useState<string>(initial?.token_limit?.toString() ?? '')

  const toggleModel = (m: string) => {
    setSelectedModels(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  const handleSave = () => {
    if (!name.trim() || !userEmail.trim() || selectedModels.length === 0) return
    onSave({
      name: name.trim(),
      user_email: userEmail.trim(),
      model_access: selectedModels,
      token_limit: tokenLimit ? parseInt(tokenLimit) : null,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#1E293B] border border-[#334155] rounded-xl shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#334155]">
          <h2 className="text-base font-semibold text-[#F8FAFC]">
            {initial ? 'Edit API Key' : 'Create Virtual API Key'}
          </h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#64748B] hover:text-[#F8FAFC] hover:bg-[#334155] transition-colors cursor-pointer">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Key Name <span className="text-[#EF4444]">*</span></label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Production - Claude Code"
              className="w-full px-3 py-2 rounded-lg bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-sm placeholder:text-[#475569] focus:outline-none focus:border-[#22C55E] transition-colors"
            />
          </div>

          {/* User email */}
          <div>
            <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Assigned User <span className="text-[#EF4444]">*</span></label>
            <input
              value={userEmail}
              onChange={e => setUserEmail(e.target.value)}
              placeholder="user@example.com"
              type="email"
              className="w-full px-3 py-2 rounded-lg bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-sm placeholder:text-[#475569] focus:outline-none focus:border-[#22C55E] transition-colors"
            />
          </div>

          {/* Models */}
          <div>
            <label className="block text-xs font-medium text-[#94A3B8] mb-2">Model Access <span className="text-[#EF4444]">*</span></label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_MODELS.map(m => (
                <button
                  key={m}
                  onClick={() => toggleModel(m)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer border ${
                    selectedModels.includes(m)
                      ? 'bg-[rgba(34,197,94,0.15)] border-[#22C55E] text-[#22C55E]'
                      : 'bg-[#0F172A] border-[#334155] text-[#64748B] hover:border-[#475569] hover:text-[#94A3B8]'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Token limit */}
          <div>
            <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Token Limit <span className="text-[#475569]">(leave blank for unlimited)</span></label>
            <input
              value={tokenLimit}
              onChange={e => setTokenLimit(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 1000000"
              className="w-full px-3 py-2 rounded-lg bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-sm font-mono placeholder:text-[#475569] focus:outline-none focus:border-[#22C55E] transition-colors"
            />
            {tokenLimit && (
              <p className="mt-1 text-[10px] text-[#64748B]">= {formatTokens(parseInt(tokenLimit))} tokens</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#334155]">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#334155] transition-colors cursor-pointer">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || !userEmail.trim() || selectedModels.length === 0}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#22C55E] text-[#0F172A] hover:bg-[#16A34A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {initial ? 'Save Changes' : 'Create Key'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ keyName, onConfirm, onCancel }: { keyName: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-[#1E293B] border border-[#334155] rounded-xl shadow-2xl animate-slide-up p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-[rgba(239,68,68,0.15)] flex items-center justify-center mx-auto mb-4">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M9 4h2a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1zM6 6h8l-.8 9.6A1 1 0 0 1 12.2 17H7.8a1 1 0 0 1-1-.4L6 6z" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 6h12" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </div>
        <h3 className="text-base font-semibold text-[#F8FAFC] mb-2">Delete API Key</h3>
        <p className="text-sm text-[#94A3B8] mb-6">
          Are you sure you want to delete <span className="text-[#F8FAFC] font-medium">{keyName}</span>? This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2 rounded-lg text-sm text-[#94A3B8] border border-[#334155] hover:bg-[#334155] transition-colors cursor-pointer">
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-[#EF4444] text-white hover:bg-[#DC2626] transition-colors cursor-pointer">
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<VirtualApiKey[]>(MOCK_VIRTUAL_KEYS)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'disabled'>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<VirtualApiKey | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<VirtualApiKey | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [revealedId, setRevealedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return keys.filter(k => {
      const matchSearch = k.name.toLowerCase().includes(search.toLowerCase()) ||
        k.user_email.toLowerCase().includes(search.toLowerCase())
      const matchFilter = filter === 'all' || (filter === 'active' ? k.is_active : !k.is_active)
      return matchSearch && matchFilter
    })
  }, [keys, search, filter])

  const handleCreate = (data: Partial<VirtualApiKey>) => {
    const newKey: VirtualApiKey = {
      id: `vk_${Date.now()}`,
      name: data.name!,
      key_prefix: `sk-vk-${Math.random().toString(36).slice(2, 6)}`,
      user_id: `u_new`,
      user_email: data.user_email!,
      model_access: data.model_access!,
      token_limit: data.token_limit ?? null,
      tokens_used: 0,
      is_active: true,
      created_at: new Date().toISOString(),
      last_used_at: null,
    }
    setKeys(prev => [newKey, ...prev])
  }

  const handleEdit = (data: Partial<VirtualApiKey>) => {
    setKeys(prev => prev.map(k => k.id === editTarget?.id ? { ...k, ...data } : k))
    setEditTarget(null)
  }

  const handleDelete = (id: string) => {
    setKeys(prev => prev.filter(k => k.id !== id))
    setDeleteTarget(null)
  }

  const handleToggle = (id: string) => {
    setKeys(prev => prev.map(k => k.id === id ? { ...k, is_active: !k.is_active } : k))
  }

  const handleCopy = (id: string, prefix: string) => {
    navigator.clipboard.writeText(`${prefix}...${Math.random().toString(36).slice(2, 10)}`)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const stats = useMemo(() => ({
    total: keys.length,
    active: keys.filter(k => k.is_active).length,
    totalTokens: keys.reduce((s, k) => s + k.tokens_used, 0),
  }), [keys])

  return (
    <div className="min-h-screen bg-[#0F172A] p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#F8FAFC] mb-1">Virtual API Keys</h1>
        <p className="text-sm text-[#64748B]">Manage per-user virtual keys with model access control and token limits.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Keys', value: stats.total, icon: <KeyIcon />, accent: '#3B82F6' },
          { label: 'Active', value: stats.active, icon: <CheckIcon />, accent: '#22C55E' },
          { label: 'Tokens Used (All)', value: formatTokens(stats.totalTokens), icon: <TokenIcon />, accent: '#A855F7' },
        ].map(({ label, value, icon, accent }) => (
          <div key={label} className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${accent}22` }}>
              <div style={{ color: accent }}>{icon}</div>
            </div>
            <div>
              <p className="text-xs text-[#64748B] mb-0.5">{label}</p>
              <p className="text-lg font-semibold font-mono text-[#F8FAFC]">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative max-w-xs flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569]" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5"/><path d="M10 10l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search keys or users..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#1E293B] border border-[#334155] text-[#F8FAFC] text-sm placeholder:text-[#475569] focus:outline-none focus:border-[#22C55E] transition-colors"
            />
          </div>

          {/* Filter pills */}
          <div className="flex gap-1">
            {(['all', 'active', 'disabled'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer capitalize ${
                  filter === f ? 'bg-[#334155] text-[#F8FAFC]' : 'text-[#64748B] hover:text-[#94A3B8]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => { setEditTarget(null); setModalOpen(true) }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#22C55E] text-[#0F172A] text-sm font-medium hover:bg-[#16A34A] transition-colors cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          Create Key
        </button>
      </div>

      {/* Table */}
      <div className="bg-[#1E293B] border border-[#334155] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#334155]">
              {['Name / User', 'Key', 'Models', 'Usage', 'Status', 'Last Used', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[#64748B] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-[#475569] text-sm">
                  No keys found matching your search.
                </td>
              </tr>
            ) : filtered.map((key, i) => {
              const pct = usagePercent(key)
              return (
                <tr
                  key={key.id}
                  className={`border-b border-[#1E293B] hover:bg-[#0F172A]/40 transition-colors ${i % 2 === 1 ? 'bg-[#0F172A]/20' : ''}`}
                >
                  {/* Name */}
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#F8FAFC] text-sm">{key.name}</p>
                    <p className="text-xs text-[#64748B] mt-0.5">{key.user_email}</p>
                  </td>

                  {/* Key prefix */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-[#94A3B8]">
                        {revealedId === key.id ? `${key.key_prefix}-****-****` : `${key.key_prefix}...`}
                      </span>
                      <button
                        onClick={() => setRevealedId(revealedId === key.id ? null : key.id)}
                        title={revealedId === key.id ? 'Hide' : 'Show'}
                        className="text-[#475569] hover:text-[#94A3B8] transition-colors cursor-pointer"
                      >
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                          {revealedId === key.id
                            ? <><path d="M1 6.5s2-4 5.5-4 5.5 4 5.5 4-2 4-5.5 4S1 6.5 1 6.5z" stroke="currentColor" strokeWidth="1.2"/><circle cx="6.5" cy="6.5" r="1.5" fill="currentColor"/><path d="M1 1l11 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></>
                            : <><path d="M1 6.5s2-4 5.5-4 5.5 4 5.5 4-2 4-5.5 4S1 6.5 1 6.5z" stroke="currentColor" strokeWidth="1.2"/><circle cx="6.5" cy="6.5" r="1.5" fill="currentColor"/></>
                          }
                        </svg>
                      </button>
                      <button
                        onClick={() => handleCopy(key.id, key.key_prefix)}
                        title="Copy key"
                        className="text-[#475569] hover:text-[#22C55E] transition-colors cursor-pointer"
                      >
                        {copiedId === key.id
                          ? <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 7l3 3 6-6" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          : <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="4" y="4" width="7" height="8" rx="1" stroke="currentColor" strokeWidth="1.2"/><path d="M2 9V2h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                        }
                      </button>
                    </div>
                  </td>

                  {/* Models */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {key.model_access.slice(0, 2).map(m => <ModelTag key={m} model={m} />)}
                      {key.model_access.length > 2 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] text-[#64748B]">+{key.model_access.length - 2}</span>
                      )}
                    </div>
                  </td>

                  {/* Usage */}
                  <td className="px-4 py-3 min-w-[140px]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono text-[#F8FAFC]">{formatTokens(key.tokens_used)}</span>
                      {key.token_limit && (
                        <span className="text-[10px] text-[#64748B]">/ {formatTokens(key.token_limit)}</span>
                      )}
                      {!key.token_limit && (
                        <span className="text-[10px] text-[#22C55E]">unlimited</span>
                      )}
                    </div>
                    {pct !== null ? (
                      <UsageBar pct={pct} />
                    ) : (
                      <div className="w-full h-1.5 rounded-full bg-[#334155]/50" />
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <StatusBadge active={key.is_active} />
                  </td>

                  {/* Last used */}
                  <td className="px-4 py-3 text-xs text-[#64748B] whitespace-nowrap">
                    {timeAgo(key.last_used_at)}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {/* Toggle */}
                      <button
                        onClick={() => handleToggle(key.id)}
                        title={key.is_active ? 'Disable' : 'Enable'}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-[#475569] hover:text-[#F59E0B] hover:bg-[#334155] transition-colors cursor-pointer"
                      >
                        {key.is_active
                          ? <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="4" width="11" height="5" rx="2.5" stroke="currentColor" strokeWidth="1.3"/><circle cx="9" cy="6.5" r="2" fill="currentColor"/></svg>
                          : <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="4" width="11" height="5" rx="2.5" stroke="currentColor" strokeWidth="1.3"/><circle cx="4" cy="6.5" r="2" fill="#475569"/></svg>
                        }
                      </button>
                      {/* Edit */}
                      <button
                        onClick={() => { setEditTarget(key); setModalOpen(true) }}
                        title="Edit"
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-[#475569] hover:text-[#3B82F6] hover:bg-[#334155] transition-colors cursor-pointer"
                      >
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M9 2l2 2L4 11H2V9L9 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
                      </button>
                      {/* Delete */}
                      <button
                        onClick={() => setDeleteTarget(key)}
                        title="Delete"
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-[#475569] hover:text-[#EF4444] hover:bg-[#334155] transition-colors cursor-pointer"
                      >
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 3h9M5 3V2h3v1M4 3l.5 7h4L9 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-[#475569]">
        {filtered.length} of {keys.length} keys shown
      </p>

      {/* Modals */}
      {modalOpen && (
        <KeyModal
          initial={editTarget}
          onClose={() => { setModalOpen(false); setEditTarget(null) }}
          onSave={editTarget ? handleEdit : handleCreate}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          keyName={deleteTarget.name}
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

// ── Icons ────────────────────────────────────────────────────────────────────

function KeyIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="6" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.4"/><path d="M9 9l5 4M12 10.5l1.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
}
function CheckIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/><path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function TokenIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="4.5" width="13" height="7" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M5 7.5h6M5 9h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
}
