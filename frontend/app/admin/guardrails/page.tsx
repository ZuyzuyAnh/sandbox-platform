'use client'

import { useEffect, useState } from 'react'
import {
  createGuardrail, deleteGuardrail, fetchGuardrails, updateGuardrail,
} from '@/lib/api'
import type { GuardrailPolicy, GuardrailType } from '@/types'

// ── Type metadata ──────────────────────────────────────────────────────────────

const TYPE_META: Record<GuardrailType, { label: string; icon: string; color: string; hint: string }> = {
  blocked_keywords: {
    label: 'Blocked keywords',
    icon: 'M3 3l10 10M13 3L3 13',
    color: 'text-danger bg-danger/10 border-danger/20',
    hint: 'Rejects prompts containing any forbidden term.',
  },
  pii_block: {
    label: 'PII protection',
    icon: 'M8 1.5l5.5 2.5v4c0 3.5-2.3 5.5-5.5 6.5C4.8 13.5 2.5 11.5 2.5 8V4z',
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    hint: 'Blocks prompts that contain emails or phone numbers.',
  },
  max_prompt_chars: {
    label: 'Prompt size limit',
    icon: 'M2 8h12M2 4h12M2 12h7',
    color: 'text-warn bg-warn/10 border-warn/20',
    hint: 'Rejects prompts longer than the configured character limit.',
  },
}

function describeConfig(p: GuardrailPolicy): string {
  if (p.type === 'blocked_keywords') {
    const kws = (p.config.keywords as string[] | undefined) ?? []
    return kws.length ? kws.join(', ') : 'no keywords set'
  }
  if (p.type === 'max_prompt_chars') {
    return `${Number(p.config.limit ?? 12000).toLocaleString()} characters`
  }
  return 'email & phone detection'
}

// ── Editor modal (create / edit) ───────────────────────────────────────────────

function GuardrailModal({ policy, onClose, onSaved }: {
  policy: GuardrailPolicy | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = policy !== null
  const [name, setName] = useState(policy?.name ?? '')
  const [description, setDescription] = useState(policy?.description ?? '')
  const [type, setType] = useState<GuardrailType>(policy?.type ?? 'blocked_keywords')
  const [keywords, setKeywords] = useState(
    policy?.type === 'blocked_keywords' ? ((policy.config.keywords as string[] | undefined) ?? []).join(', ') : '',
  )
  const [limit, setLimit] = useState(
    policy?.type === 'max_prompt_chars' ? String(policy.config.limit ?? 12000) : '12000',
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function buildConfig(): Record<string, unknown> {
    if (type === 'blocked_keywords') {
      return { keywords: keywords.split(',').map(s => s.trim()).filter(Boolean) }
    }
    if (type === 'max_prompt_chars') {
      return { limit: Number(limit) || 12000 }
    }
    return {}
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (isEdit) {
        await updateGuardrail(policy!.id, { name, description: description || null, config: buildConfig() })
      } else {
        await createGuardrail({ name, description: description || null, type, config: buildConfig() })
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={handleSave} className="relative w-full max-w-md bg-surface border border-line rounded-2xl shadow-2xl animate-scale-in">
        <div className="px-6 py-4 border-b border-line">
          <h2 className="text-base font-semibold font-display text-fg">{isEdit ? 'Edit guardrail' : 'New guardrail'}</h2>
          <p className="text-xs text-fg-subtle mt-0.5">Checks run on the prompt before it reaches the model.</p>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
              placeholder="e.g. Block secrets"
              className="w-full px-3 py-2.5 rounded-lg bg-app border border-line text-fg text-sm placeholder:text-fg-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Description <span className="text-fg-subtle">(optional)</span></label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What does this rule protect against?"
              className="w-full px-3 py-2.5 rounded-lg bg-app border border-line text-fg text-sm placeholder:text-fg-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            />
          </div>

          {/* Type selector — only editable on create */}
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Type</label>
            <div className="grid grid-cols-1 gap-1.5">
              {(Object.keys(TYPE_META) as GuardrailType[]).map(t => {
                const meta = TYPE_META[t]
                const active = type === t
                const disabled = isEdit && type !== t
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => !isEdit && setType(t)}
                    disabled={disabled}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-colors ${
                      active ? 'bg-accent/10 border-accent/30' : 'bg-app border-line'
                    } ${isEdit ? 'cursor-default' : 'cursor-pointer hover:border-fg-subtle/40'} ${disabled ? 'opacity-30' : ''}`}
                  >
                    <span className={`w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d={meta.icon} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-medium text-fg">{meta.label}</span>
                      <span className="block text-[11px] text-fg-subtle truncate">{meta.hint}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            {isEdit && <p className="text-[10px] text-fg-subtle mt-1.5">Type can't be changed after creation.</p>}
          </div>

          {/* Type-specific config */}
          {type === 'blocked_keywords' && (
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Keywords <span className="text-fg-subtle">(comma-separated)</span></label>
              <textarea
                value={keywords}
                onChange={e => setKeywords(e.target.value)}
                rows={3}
                placeholder="password, api_key, secret"
                className="w-full px-3 py-2.5 rounded-lg bg-app border border-line text-fg text-sm font-mono placeholder:text-fg-subtle placeholder:font-sans focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all resize-none"
              />
            </div>
          )}
          {type === 'max_prompt_chars' && (
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Max characters</label>
              <input
                value={limit}
                onChange={e => setLimit(e.target.value.replace(/[^\d]/g, ''))}
                inputMode="numeric"
                placeholder="12000"
                className="w-full px-3 py-2.5 rounded-lg bg-app border border-line text-fg text-sm font-mono focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
              />
            </div>
          )}
          {type === 'pii_block' && (
            <p className="text-[11px] text-fg-subtle bg-app border border-line rounded-lg px-3 py-2.5">
              Detects emails and phone numbers automatically — no configuration needed.
            </p>
          )}

          {error && (
            <p role="alert" className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</p>
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
            {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create guardrail'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function GuardrailsPage() {
  const [policies, setPolicies] = useState<GuardrailPolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalTarget, setModalTarget] = useState<GuardrailPolicy | null | 'new'>(null)

  async function load() {
    try {
      setPolicies(await fetchGuardrails())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load guardrails')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleToggle(p: GuardrailPolicy) {
    try {
      await updateGuardrail(p.id, { enabled: !p.enabled })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update')
    }
  }

  async function handleDelete(p: GuardrailPolicy) {
    if (!confirm(`Delete guardrail "${p.name}"? It will be removed from all keys.`)) return
    try {
      await deleteGuardrail(p.id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 animate-rise">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold font-display tracking-tight mb-1">Guardrails</h1>
          <p className="text-sm text-fg-subtle">Content rules enforced on prompts before they reach the model. Attach them to keys in the API Keys tab.</p>
        </div>
        <button
          onClick={() => setModalTarget('new')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-fg text-sm font-semibold hover:bg-accent-hover active:scale-[0.98] transition-all cursor-pointer"
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          New guardrail
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-4 text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</p>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2].map(i => <div key={i} className="h-28 skeleton rounded-xl" />)}
        </div>
      ) : policies.length === 0 ? (
        <div className="bg-surface border border-line rounded-2xl flex flex-col items-center justify-center py-20 gap-4">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="text-fg-subtle opacity-40">
            <path d="M12 2l8 4v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
          <div className="text-center">
            <p className="text-sm font-medium text-fg-muted mb-1">No guardrails defined</p>
            <p className="text-xs text-fg-subtle max-w-sm">Create a rule to block secrets, PII, or oversized prompts before they hit the LLM.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {policies.map(p => {
            const meta = TYPE_META[p.type]
            return (
              <div key={p.id} className="bg-surface border border-line rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span className={`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d={meta.icon} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-fg truncate">{p.name}</h3>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${
                        p.enabled ? 'bg-ok/15 text-ok' : 'bg-raised text-fg-subtle'
                      }`}>{p.enabled ? 'on' : 'off'}</span>
                    </div>
                    <p className="text-[11px] text-fg-subtle mt-0.5">{meta.label}</p>
                  </div>
                  {/* Toggle switch */}
                  <button
                    onClick={() => handleToggle(p)}
                    className={`relative w-8 h-[18px] rounded-full transition-colors flex-shrink-0 cursor-pointer ${p.enabled ? 'bg-accent' : 'bg-raised border border-line'}`}
                    aria-label="Toggle guardrail"
                  >
                    <span className={`absolute top-[2px] w-3.5 h-3.5 rounded-full bg-white shadow transition-all ${p.enabled ? 'left-[14px]' : 'left-[2px]'}`} />
                  </button>
                </div>

                {p.description && <p className="text-xs text-fg-muted leading-relaxed">{p.description}</p>}

                <div className="text-[11px] text-fg-subtle bg-app border border-line rounded-lg px-2.5 py-1.5 font-mono truncate" title={describeConfig(p)}>
                  {describeConfig(p)}
                </div>

                <div className="flex items-center gap-2 mt-auto pt-1">
                  <button
                    onClick={() => setModalTarget(p)}
                    className="px-2.5 py-1 text-xs font-medium rounded-md text-fg-subtle hover:text-fg hover:bg-raised transition-colors cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(p)}
                    className="px-2.5 py-1 text-xs font-medium rounded-md text-fg-subtle hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modalTarget !== null && (
        <GuardrailModal
          policy={modalTarget === 'new' ? null : modalTarget}
          onClose={() => setModalTarget(null)}
          onSaved={() => { setModalTarget(null); load() }}
        />
      )}
    </div>
  )
}
