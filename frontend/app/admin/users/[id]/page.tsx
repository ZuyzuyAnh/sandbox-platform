'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  Cell, Pie, PieChart, ResponsiveContainer, Tooltip,
} from 'recharts'
import {
  fetchGuardrails, fetchUserGuardrails, fetchUserOverview,
  patchUser, setUserGuardrails,
} from '@/lib/api'
import { useChartColors } from '@/lib/theme'
import type { ChatExchange, GuardrailPolicy, SandboxRole, UserOverview, UserRecord } from '@/types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function shortId(id: string): string {
  return id.slice(0, 8)
}

const SANDBOX_ROLES: { value: SandboxRole; label: string }[] = [
  { value: 'ba', label: 'BA' },
  { value: 'dev', label: 'Dev' },
  { value: 'tester', label: 'Tester' },
  { value: 'devops', label: 'DevOps' },
]

const LIMIT_PRESETS = [
  { label: '1K / min',   limit: 1_000,    window: 1 },
  { label: '10K / hr',   limit: 10_000,   window: 60 },
  { label: '100K / day', limit: 100_000,  window: 1440 },
  { label: '∞ Unlimited', limit: null,    window: null },
]

type Tab = 'overview' | 'sessions' | 'chat' | 'settings'

// ── UI bits ──────────────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="bg-surface border border-line rounded-lg p-2.5 shadow-xl text-xs">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-sm" style={{ background: p.payload.fill }} />
        <span className="text-fg-subtle">{p.name}</span>
        <span className="text-fg font-mono ml-3">{formatTokens(p.value)}</span>
      </div>
    </div>
  )
}

function Hint({ text }: { text: string }) {
  return (
    <span
      title={text}
      className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-fg-subtle/40 text-[8px] text-fg-subtle cursor-help align-middle ml-1"
    >
      ?
    </span>
  )
}

function StatCard({ label, value, sub, accent, delay, hint }: {
  label: string; value: string; sub?: string; accent?: boolean; delay: number; hint?: string
}) {
  return (
    <div className="bg-surface border border-line rounded-xl p-4 animate-rise" style={{ animationDelay: `${delay}ms` }}>
      <p className="text-[10px] font-medium text-fg-subtle uppercase tracking-widest mb-1">
        {label}{hint && <Hint text={hint} />}
      </p>
      <p className={`text-2xl font-bold font-mono ${accent ? 'text-accent' : 'text-fg'}`}>{value}</p>
      {sub && <p className="text-xs text-fg-subtle mt-1">{sub}</p>}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function UserDashboardPage() {
  const params = useParams<{ id: string }>()
  const userId = params.id
  const colors = useChartColors()

  const [data, setData] = useState<UserOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [sessionFilter, setSessionFilter] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const [allPolicies, setAllPolicies] = useState<GuardrailPolicy[]>([])
  const [userPolicyIds, setUserPolicyIds] = useState<string[]>([])

  function reloadOverview() {
    return fetchUserOverview(userId).then(setData)
  }

  useEffect(() => {
    reloadOverview()
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
    Promise.all([
      fetchGuardrails().catch(() => [] as GuardrailPolicy[]),
      fetchUserGuardrails(userId).catch(() => [] as string[]),
    ]).then(([all, ids]) => {
      setAllPolicies(all)
      setUserPolicyIds(ids)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const totalTokens = useMemo(
    () => (data ? data.total_input + data.total_output : 0),
    [data],
  )

  const sessionLabel = useMemo(() => {
    const m: Record<string, string> = {}
    data?.sessions.forEach((s, i) => { m[s.id] = `Session ${data.sessions.length - i}` })
    return m
  }, [data])

  const filteredChat = useMemo(() => {
    if (!data) return []
    if (!sessionFilter) return data.chat
    return data.chat.filter(c => c.session_id === sessionFilter)
  }, [data, sessionFilter])

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="h-6 w-48 skeleton rounded mb-2" />
        <div className="h-4 w-72 skeleton rounded mb-6" />
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[0, 1, 2, 3].map(i => <div key={i} className="h-24 skeleton rounded-xl" />)}
        </div>
        <div className="h-64 skeleton rounded-xl" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <Link href="/admin/users" className="text-xs text-fg-subtle hover:text-fg">← Back to users</Link>
        <p className="mt-4 text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
          {error ?? 'No data'}
        </p>
      </div>
    )
  }

  const { user } = data

  return (
    <div className="max-w-5xl mx-auto p-6 animate-rise">
      {/* Header */}
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-xs text-fg-subtle hover:text-fg-muted transition-colors mb-4">
        <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
          <path d="M8 2L4 6.5 8 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to users
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-accent/15 border border-accent/20 flex items-center justify-center text-accent font-semibold text-lg">
            {user.email.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-semibold font-display tracking-tight">{user.email}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${user.role === 'admin' ? 'bg-accent/15 text-accent' : 'bg-raised text-fg-muted'}`}>
                {user.role}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${user.is_active ? 'bg-ok/15 text-ok' : 'bg-danger/15 text-danger'}`}>
                {user.is_active ? 'active' : 'disabled'}
              </span>
              {user.sandbox_role && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/15 text-blue-400">
                  {user.sandbox_role.toUpperCase()}
                </span>
              )}
              <span className="text-[11px] text-fg-subtle font-mono">{shortId(user.id)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI cards — billed (real) tokens are primary; message content shown below */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Total tokens" accent delay={0}
          value={formatTokens(totalTokens)}
          sub={`${formatTokens(data.total_content_input + data.total_content_output)} message content`}
          hint="Billed total — includes Claude Code's system prompt & tool definitions (~15-20k fixed overhead per message). The smaller number below is just the conversation text."
        />
        <StatCard
          label="Input" delay={50}
          value={formatTokens(data.total_input)}
          sub={`${formatTokens(data.total_content_input)} sent`}
          hint="Billed input tokens (full context). 'sent' = tokens of just what the user typed."
        />
        <StatCard
          label="Output" delay={100}
          value={formatTokens(data.total_output)}
          sub={`${formatTokens(data.total_content_output)} reply`}
          hint="Billed output tokens. 'reply' = tokens of the model's text answer."
        />
        <StatCard label="Requests" value={data.total_requests.toLocaleString()} sub={`${data.sessions.length} sessions`} delay={150} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface border border-line rounded-lg p-1 w-fit mb-5">
        {([
          ['overview', 'Overview'],
          ['sessions', `Sessions (${data.sessions.length})`],
          ['chat', `Chat history (${data.chat.length})`],
          ['settings', 'Settings'],
        ] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              tab === t ? 'bg-raised text-fg' : 'text-fg-subtle hover:text-fg-muted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Overview tab ──────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-2 gap-4">
          {/* Model donut */}
          <div className="bg-surface border border-line rounded-xl p-5">
            <h3 className="text-sm font-semibold font-display text-fg mb-1">Token usage by model</h3>
            <p className="text-xs text-fg-subtle mb-3">Share of total tokens</p>
            {data.by_model.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-xs text-fg-subtle">No usage yet</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={data.by_model.map(m => ({ name: m.model, value: m.tokens }))}
                      cx="50%" cy="50%" innerRadius={56} outerRadius={80}
                      paddingAngle={data.by_model.length > 1 ? 3 : 0}
                      dataKey="value" strokeWidth={0}
                    >
                      {data.by_model.map((_, i) => (
                        <Cell key={i} fill={colors.series[i % colors.series.length]} fillOpacity={0.88} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-1.5 mt-1">
                  {data.by_model.slice(0, 5).map((m, i) => {
                    const pct = totalTokens > 0 ? ((m.tokens / totalTokens) * 100).toFixed(1) : '0.0'
                    return (
                      <div key={m.model} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colors.series[i % colors.series.length] }} />
                        <span className="text-[11px] font-mono text-fg-muted truncate flex-1" title={m.model}>{m.model}</span>
                        <span className="text-[11px] font-mono text-fg-subtle flex-shrink-0">{pct}%</span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {/* Per-model breakdown table */}
          <div className="bg-surface border border-line rounded-xl p-5">
            <h3 className="text-sm font-semibold font-display text-fg mb-4">Model breakdown</h3>
            {data.by_model.length === 0 ? (
              <div className="flex items-center justify-center h-[180px] text-xs text-fg-subtle">No data</div>
            ) : (
              <div className="flex flex-col gap-3">
                {data.by_model.map((m, i) => {
                  const max = data.by_model[0]?.tokens ?? 1
                  return (
                    <div key={m.model}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono text-fg-muted truncate">{m.model}</span>
                        <span className="text-xs font-mono text-fg-subtle flex-shrink-0 pl-3">
                          {formatTokens(m.tokens)} · {m.requests} req
                        </span>
                      </div>
                      <div className="h-1.5 bg-raised rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${(m.tokens / max) * 100}%`, background: colors.series[i % colors.series.length] }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Token limit card */}
          <div className="bg-surface border border-line rounded-xl p-5 col-span-2">
            <h3 className="text-sm font-semibold font-display text-fg mb-3">Rate limit</h3>
            {user.token_limit != null && user.token_limit_window_minutes != null ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-warn" />
                <span className="text-fg-muted">
                  <span className="font-mono text-warn font-medium">{formatTokens(user.token_limit)} tokens</span>
                  {' '}per {user.token_limit_window_minutes} min window
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-ok" />
                <span className="text-fg-subtle">Unlimited — no rate limit set</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Sessions tab ──────────────────────────────────────────────────── */}
      {tab === 'sessions' && (
        <div className="bg-surface border border-line rounded-xl overflow-hidden">
          {data.sessions.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-fg-subtle">No sessions</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-raised/40">
                    {['Session', 'Status', 'Created', 'Expires', 'Messages', 'Tokens', ''].map(h => (
                      <th key={h} className="px-5 py-2.5 text-left text-xs font-medium text-fg-subtle whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.sessions.map(s => (
                    <tr key={s.id} className="border-b border-line/50 last:border-0 hover:bg-raised/40 transition-colors">
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className="text-fg font-medium">{sessionLabel[s.id]}</span>
                        <span className="text-fg-subtle font-mono text-xs ml-2">{shortId(s.id)}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          s.status === 'running' ? 'bg-ok/15 text-ok' : 'bg-raised text-fg-muted'
                        }`}>{s.status}</span>
                      </td>
                      <td className="px-5 py-3 text-xs text-fg-subtle whitespace-nowrap">{formatDateTime(s.created_at)}</td>
                      <td className="px-5 py-3 text-xs text-fg-subtle whitespace-nowrap">{formatDateTime(s.expires_at)}</td>
                      <td className="px-5 py-3 font-mono text-xs text-fg-muted">{s.message_count}</td>
                      <td className="px-5 py-3 font-mono text-xs text-accent">{formatTokens(s.tokens)}</td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        {s.message_count > 0 && (
                          <button
                            onClick={() => { setSessionFilter(s.id); setTab('chat') }}
                            className="text-xs text-fg-subtle hover:text-accent transition-colors cursor-pointer"
                          >
                            View chat →
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Chat history tab ──────────────────────────────────────────────── */}
      {tab === 'chat' && (
        <div>
          {sessionFilter && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-fg-subtle">Filtered to</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-accent/15 text-accent">
                {sessionLabel[sessionFilter] ?? shortId(sessionFilter)}
              </span>
              <button
                onClick={() => setSessionFilter(null)}
                className="text-xs text-fg-subtle hover:text-fg transition-colors cursor-pointer"
              >
                ✕ clear
              </button>
            </div>
          )}

          {filteredChat.length === 0 ? (
            <div className="bg-surface border border-line rounded-xl flex flex-col items-center justify-center py-16 gap-3">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="text-fg-subtle opacity-40">
                <path d="M3 5a2 2 0 012-2h14a2 2 0 012 2v9a2 2 0 01-2 2H8l-5 4V5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
              <p className="text-sm text-fg-subtle">No chat history recorded</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredChat.map(c => (
                <ChatCard key={c.id} c={c} expanded={expanded.has(c.id)} onToggle={() => toggleExpand(c.id)} sessionLabel={c.session_id ? sessionLabel[c.session_id] : null} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Settings tab ──────────────────────────────────────────────────── */}
      {tab === 'settings' && (
        <SettingsTab
          user={user}
          allPolicies={allPolicies}
          initialPolicyIds={userPolicyIds}
          onChanged={() => {
            reloadOverview()
            fetchUserGuardrails(userId).then(setUserPolicyIds).catch(() => {})
          }}
        />
      )}
    </div>
  )
}

// ── Chat exchange card ─────────────────────────────────────────────────────────

function ChatCard({ c, expanded, onToggle, sessionLabel }: {
  c: ChatExchange; expanded: boolean; onToggle: () => void; sessionLabel: string | null
}) {
  const preview = c.prompt.length > 140 && !expanded ? c.prompt.slice(0, 140) + '…' : c.prompt
  return (
    <div className="bg-surface border border-line rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-2.5 border-b border-line bg-raised/30 hover:bg-raised/50 transition-colors cursor-pointer text-left"
      >
        <svg width="11" height="11" viewBox="0 0 8 5" fill="none" className={`text-fg-subtle transition-transform ${expanded ? 'rotate-180' : ''}`}>
          <path d="M1 1L4 4L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-xs font-mono text-fg-muted">{c.model}</span>
        {sessionLabel && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent/10 text-accent">{sessionLabel}</span>
        )}
        <span className="text-xs text-fg-subtle ml-auto whitespace-nowrap">{formatDateTime(c.created_at)}</span>
        <span
          className="text-[11px] font-mono text-fg-subtle whitespace-nowrap cursor-help"
          title={`Message content: ${c.content_input_tokens} in / ${c.content_output_tokens} out\nBilled (full context): ${c.input_tokens.toLocaleString()} in / ${c.output_tokens.toLocaleString()} out`}
        >
          {c.content_input_tokens}→{c.content_output_tokens}
          <span className="text-fg-subtle/50"> · {formatTokens(c.input_tokens + c.output_tokens)} billed</span>
        </span>
      </button>

      <div className="px-4 py-3 flex flex-col gap-3">
        {/* Prompt */}
        <div className="flex gap-2.5">
          <span className="flex-shrink-0 w-6 h-6 rounded-md bg-blue-500/15 text-blue-400 flex items-center justify-center text-[10px] font-bold">Q</span>
          <p className={`text-sm text-fg-muted whitespace-pre-wrap break-words ${!expanded ? 'line-clamp-3' : ''}`}>
            {preview || <span className="italic text-fg-subtle">(empty prompt)</span>}
          </p>
        </div>
        {/* Response (only when expanded) */}
        {expanded && (
          <div className="flex gap-2.5">
            <span className="flex-shrink-0 w-6 h-6 rounded-md bg-accent/15 text-accent flex items-center justify-center text-[10px] font-bold">A</span>
            <p className="text-sm text-fg whitespace-pre-wrap break-words">
              {c.response || <span className="italic text-fg-subtle">(no text response — likely tool calls only)</span>}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Settings tab ───────────────────────────────────────────────────────────────

function SettingsTab({ user, allPolicies, initialPolicyIds, onChanged }: {
  user: UserRecord
  allPolicies: GuardrailPolicy[]
  initialPolicyIds: string[]
  onChanged: () => void
}) {
  const [role, setRole] = useState<'user' | 'admin'>(user.role === 'admin' ? 'admin' : 'user')
  const [active, setActive] = useState(user.is_active)
  const [sandboxRole, setSandboxRole] = useState<SandboxRole | null>(user.sandbox_role)
  const [limit, setLimit] = useState(user.token_limit?.toString() ?? '')
  const [window_, setWindow] = useState(user.token_limit_window_minutes?.toString() ?? '')
  const [selected, setSelected] = useState<Set<string>>(new Set(initialPolicyIds))

  const [savingAccess, setSavingAccess] = useState(false)
  const [savingLimit, setSavingLimit] = useState(false)
  const [savingGuard, setSavingGuard] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  function notify(msg: string) {
    setFlash(msg)
    setTimeout(() => setFlash(null), 2000)
  }

  async function saveAccess() {
    setSavingAccess(true)
    setError(null)
    try {
      await patchUser(user.id, { role, is_active: active, sandbox_role: sandboxRole })
      onChanged()
      notify('Access updated')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save access')
    } finally {
      setSavingAccess(false)
    }
  }

  async function saveLimit() {
    setSavingLimit(true)
    setError(null)
    try {
      await patchUser(user.id, {
        token_limit: limit.trim() ? Number(limit) : null,
        token_limit_window_minutes: window_.trim() ? Number(window_) : null,
      })
      onChanged()
      notify('Rate limit updated')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save limit')
    } finally {
      setSavingLimit(false)
    }
  }

  async function saveGuardrails() {
    setSavingGuard(true)
    setError(null)
    try {
      await setUserGuardrails(user.id, Array.from(selected))
      onChanged()
      notify('Guardrails updated')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save guardrails')
    } finally {
      setSavingGuard(false)
    }
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const sandboxBadge: Record<SandboxRole, string> = {
    ba: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    dev: 'bg-accent/15 text-accent border-accent/30',
    tester: 'bg-ok/15 text-ok border-ok/30',
    devops: 'bg-warn/15 text-warn border-warn/30',
  }

  return (
    <div className="flex flex-col gap-4">
      {(error || flash) && (
        <p className={`text-xs rounded-lg px-3 py-2 border ${error ? 'text-danger bg-danger/10 border-danger/20' : 'text-ok bg-ok/10 border-ok/20'}`}>
          {error ?? flash}
        </p>
      )}

      {/* Access & role */}
      <section className="bg-surface border border-line rounded-xl p-5">
        <h3 className="text-sm font-semibold font-display text-fg mb-1">Access & role</h3>
        <p className="text-xs text-fg-subtle mb-4">Account permission, activation state, and which sandbox image this user gets.</p>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Account role</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as 'user' | 'admin')}
              className="w-full px-3 py-2 text-sm bg-app border border-line rounded-lg text-fg focus:outline-none focus:border-accent transition-colors"
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Status</label>
            <button
              type="button"
              onClick={() => setActive(a => !a)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium w-full transition-colors cursor-pointer ${
                active ? 'bg-ok/10 text-ok border-ok/20' : 'bg-danger/10 text-danger border-danger/20'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${active ? 'bg-ok' : 'bg-danger'}`} />
              {active ? 'Active' : 'Disabled'}
            </button>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium text-fg-muted mb-1.5">Sandbox role <span className="text-fg-subtle font-normal">— maps to a VS Code image</span></label>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSandboxRole(null)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                sandboxRole === null ? 'bg-raised text-fg border-fg-subtle/40' : 'bg-app text-fg-subtle border-line hover:text-fg'
              }`}
            >
              — none —
            </button>
            {SANDBOX_ROLES.map(r => (
              <button
                key={r.value}
                type="button"
                onClick={() => setSandboxRole(r.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                  sandboxRole === r.value ? sandboxBadge[r.value] : 'bg-app text-fg-muted border-line hover:text-fg'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={saveAccess}
            disabled={savingAccess}
            className="px-4 py-1.5 text-sm font-semibold bg-accent text-accent-fg rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors cursor-pointer"
          >
            {savingAccess ? 'Saving...' : 'Save access'}
          </button>
        </div>
      </section>

      {/* Rate limit */}
      <section className="bg-surface border border-line rounded-xl p-5">
        <h3 className="text-sm font-semibold font-display text-fg mb-1">Rate limit</h3>
        <p className="text-xs text-fg-subtle mb-4">Max tokens this user may spend per time window. Leave both empty for unlimited.</p>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {LIMIT_PRESETS.map(p => (
            <button
              key={p.label}
              type="button"
              onClick={() => { setLimit(p.limit?.toString() ?? ''); setWindow(p.window?.toString() ?? '') }}
              className="px-3 py-1.5 text-xs rounded-lg bg-app border border-line text-fg-muted hover:text-fg hover:border-accent/50 transition-colors cursor-pointer"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Token limit <span className="text-fg-subtle font-normal">(empty = ∞)</span></label>
            <input
              value={limit}
              onChange={e => setLimit(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              placeholder="e.g. 100000"
              className="w-full px-3 py-2 text-sm bg-app border border-line rounded-lg text-fg font-mono placeholder:text-fg-subtle placeholder:font-sans focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Window <span className="text-fg-subtle font-normal">(minutes)</span></label>
            <input
              value={window_}
              onChange={e => setWindow(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              placeholder="e.g. 1440"
              className="w-full px-3 py-2 text-sm bg-app border border-line rounded-lg text-fg font-mono placeholder:text-fg-subtle placeholder:font-sans focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            />
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={saveLimit}
            disabled={savingLimit}
            className="px-4 py-1.5 text-sm font-semibold bg-accent text-accent-fg rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors cursor-pointer"
          >
            {savingLimit ? 'Saving...' : 'Save limit'}
          </button>
        </div>
      </section>

      {/* Guardrails */}
      <section className="bg-surface border border-line rounded-xl p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold font-display text-fg">Guardrails</h3>
          <span className="text-[11px] text-fg-subtle">{selected.size} of {allPolicies.length} active</span>
        </div>
        <p className="text-xs text-fg-subtle mb-4">Content rules enforced on every prompt this user sends, on top of any key-level rules.</p>

        {allPolicies.length === 0 ? (
          <p className="text-[11px] text-fg-subtle bg-app border border-line rounded-lg px-3 py-2.5">
            No guardrail policies defined yet. Create them in the Guardrails tab of the console.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {allPolicies.map(p => {
              const on = selected.has(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                    on ? 'bg-accent/10 border-accent/30' : 'bg-app border-line hover:border-fg-subtle/40'
                  }`}
                >
                  <span className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${on ? 'bg-accent border-accent' : 'border-line'}`}>
                    {on && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 6.5L4.5 9 10 3" stroke="rgb(var(--accent-fg))" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-xs font-medium ${on ? 'text-fg' : 'text-fg-muted'}`}>
                      {p.name}
                      {!p.enabled && <span className="ml-2 text-[10px] text-fg-subtle">(disabled globally)</span>}
                    </span>
                    {p.description && <span className="block text-[11px] text-fg-subtle">{p.description}</span>}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {allPolicies.length > 0 && (
          <div className="flex justify-end mt-4">
            <button
              onClick={saveGuardrails}
              disabled={savingGuard}
              className="px-4 py-1.5 text-sm font-semibold bg-accent text-accent-fg rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors cursor-pointer"
            >
              {savingGuard ? 'Saving...' : 'Save guardrails'}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
