'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { downloadUsageReport, fetchTokenUsage, fetchUsers, fetchVirtualKeys } from '@/lib/api'
import { useChartColors } from '@/lib/theme'
import type { TokenUsage, VirtualKey } from '@/types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

function formatDay(key: string): string {
  return new Date(`${key}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

type Range = '7d' | '14d' | '30d'
const RANGE_DAYS: Record<Range, number> = { '7d': 7, '14d': 14, '30d': 30 }

function exportCSV(rows: TokenUsage[]) {
  const header = 'created_at,model,input_tokens,output_tokens,virtual_key_id,session_id,user_id'
  const lines = rows.map(r =>
    `${r.created_at},${r.model},${r.input_tokens},${r.output_tokens},${r.virtual_key_id},${r.session_id ?? ''},${r.user_id}`
  )
  const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `llm-usage-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── UI bits ──────────────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-line rounded-lg p-3 shadow-xl text-xs">
      <p className="text-fg-muted mb-2 font-medium">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-1 last:mb-0">
          <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: p.color ?? p.fill }} />
          <span className="text-fg-subtle">{p.name}</span>
          <span className="text-fg font-mono ml-auto pl-4">{formatTokens(p.value)}</span>
        </div>
      ))}
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

function StatCard({ label, value, sub, delay, hint }: { label: string; value: string; sub?: string; delay: number; hint?: string }) {
  return (
    <div className="bg-surface border border-line rounded-xl p-4 animate-rise" style={{ animationDelay: `${delay}ms` }}>
      <p className="text-[10px] font-medium text-fg-subtle uppercase tracking-widest mb-1">{label}{hint && <Hint text={hint} />}</p>
      <p className="text-2xl font-bold font-mono text-fg">{value}</p>
      {sub && <p className="text-xs text-fg-subtle mt-1">{sub}</p>}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function UsagePage() {
  const [usage, setUsage] = useState<TokenUsage[]>([])
  const [keys, setKeys] = useState<VirtualKey[]>([])
  const [emailByUserId, setEmailByUserId] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<Range>('30d')
  const [exporting, setExporting] = useState(false)
  const colors = useChartColors()

  async function exportPNG() {
    setExporting(true)
    try {
      const blob = await downloadUsageReport(RANGE_DAYS[range])
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `usage-report-${new Date().toISOString().slice(0, 10)}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to export report')
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    Promise.all([
      fetchTokenUsage(),
      fetchVirtualKeys().catch(() => [] as VirtualKey[]),
      fetchUsers().catch(() => []),
    ])
      .then(([u, k, users]) => {
        setUsage(u)
        setKeys(k)
        setEmailByUserId(Object.fromEntries(users.map(x => [x.id, x.email])))
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load usage'))
      .finally(() => setLoading(false))
  }, [])

  const keyLabel = useMemo(() => {
    const m: Record<string, string> = {}
    for (const k of keys) m[k.id] = k.label ?? `${k.key_prefix}...`
    return m
  }, [keys])

  // Rows inside the selected range
  const rows = useMemo(() => {
    const cutoff = Date.now() - RANGE_DAYS[range] * 86_400_000
    return usage.filter(r => new Date(r.created_at).getTime() >= cutoff)
  }, [usage, range])

  // Daily aggregation (fill empty days so the chart has a continuous axis)
  const daily = useMemo(() => {
    const byDay = new Map<string, { input: number; output: number; requests: number }>()
    for (let i = RANGE_DAYS[range] - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000)
      byDay.set(dayKey(d.toISOString()), { input: 0, output: 0, requests: 0 })
    }
    for (const r of rows) {
      const k = dayKey(r.created_at)
      const agg = byDay.get(k)
      if (!agg) continue
      agg.input += r.input_tokens
      agg.output += r.output_tokens
      agg.requests += 1
    }
    return Array.from(byDay.entries()).map(([k, v]) => ({
      date: formatDay(k),
      Input: v.input,
      Output: v.output,
      requests: v.requests,
    }))
  }, [rows, range])

  const byModel = useMemo(() => {
    const m = new Map<string, { tokens: number; requests: number }>()
    for (const r of rows) {
      const agg = m.get(r.model) ?? { tokens: 0, requests: 0 }
      agg.tokens += r.input_tokens + r.output_tokens
      agg.requests += 1
      m.set(r.model, agg)
    }
    return Array.from(m.entries())
      .map(([model, v]) => ({ model, ...v }))
      .sort((a, b) => b.tokens - a.tokens)
  }, [rows])

  const byKey = useMemo(() => {
    const m = new Map<string, { tokens: number; requests: number; userId: string }>()
    for (const r of rows) {
      const agg = m.get(r.virtual_key_id) ?? { tokens: 0, requests: 0, userId: r.user_id }
      agg.tokens += r.input_tokens + r.output_tokens
      agg.requests += 1
      m.set(r.virtual_key_id, agg)
    }
    return Array.from(m.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.tokens - a.tokens)
  }, [rows])

  const totals = useMemo(() => {
    let input = 0
    let output = 0
    let contentIn = 0
    let contentOut = 0
    for (const r of rows) {
      input += r.input_tokens
      output += r.output_tokens
      contentIn += r.content_input_tokens ?? 0
      contentOut += r.content_output_tokens ?? 0
    }
    return { input, output, tokens: input + output, contentIn, contentOut, content: contentIn + contentOut, requests: rows.length }
  }, [rows])

  const maxKeyTokens = byKey[0]?.tokens ?? 1

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

  return (
    <div className="max-w-5xl mx-auto p-6 animate-rise">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold font-display tracking-tight mb-1">Usage analytics</h1>
          <p className="text-sm text-fg-subtle">Token consumption across the gateway. One record per proxied message.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportCSV(rows)}
            disabled={rows.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-line text-sm text-fg-muted hover:text-fg hover:border-fg-subtle/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1v8M4 6l3 3 3-3M2 12h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Export CSV
          </button>
          <button
            onClick={exportPNG}
            disabled={exporting || rows.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/10 border border-accent/20 text-sm font-medium text-accent hover:bg-accent/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <rect x="1.5" y="1.5" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" />
              <path d="M1.5 9.5L5 6l3 3 4.5-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {exporting ? 'Rendering...' : 'Export PNG report'}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-4 text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Range selector */}
      <div className="flex gap-1 bg-surface border border-line rounded-lg p-1 w-fit mb-4">
        {(Object.keys(RANGE_DAYS) as Range[]).map(r => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              range === r ? 'bg-raised text-fg' : 'text-fg-subtle hover:text-fg-muted'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <StatCard label="Total tokens" value={formatTokens(totals.tokens)} sub={`${formatTokens(totals.content)} message content`} delay={0}
          hint="Billed total — includes the agent's system prompt & tool definitions (~15-20k fixed overhead per request). The number below is just the conversation text." />
        <StatCard label="Input tokens" value={formatTokens(totals.input)} sub={`${formatTokens(totals.contentIn)} sent`} delay={50}
          hint="Billed input (full context). 'sent' = tokens of just what users typed." />
        <StatCard label="Output tokens" value={formatTokens(totals.output)} sub={`${formatTokens(totals.contentOut)} reply`} delay={100}
          hint="Billed output. 'reply' = tokens of the models' text answers." />
        <StatCard label="Requests" value={totals.requests.toLocaleString()} sub={`${keys.filter(k => k.is_active).length} active keys`} delay={150} />
      </div>

      {rows.length === 0 ? (
        /* Empty state */
        <div className="bg-surface border border-line rounded-2xl flex flex-col items-center justify-center py-20 gap-4">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-fg-subtle opacity-40">
            <path d="M4 32L13 20l7 7 12-16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M25 11h7v7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="text-center">
            <p className="text-sm font-medium text-fg-muted mb-1">No usage recorded yet</p>
            <p className="text-xs text-fg-subtle max-w-sm">
              Token usage appears here once Claude Code inside a sandbox starts sending requests through the gateway with a virtual key.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Daily trend */}
          <div className="bg-surface border border-line rounded-xl p-5 mb-4">
            <h3 className="text-sm font-semibold font-display text-fg mb-4">Daily token usage</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={daily} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.accent} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={colors.accent} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.neutral} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={colors.neutral} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: colors.tick }} axisLine={false} tickLine={false} interval={range === '7d' ? 0 : range === '14d' ? 1 : 4} />
                <YAxis tick={{ fontSize: 10, fill: colors.tick }} axisLine={false} tickLine={false} tickFormatter={v => formatTokens(v)} width={48} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="Input" stroke={colors.neutral} strokeWidth={1.5} fill="url(#gradIn)" />
                <Area type="monotone" dataKey="Output" stroke={colors.accent} strokeWidth={1.8} fill="url(#gradOut)" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-5 mt-2">
              <span className="flex items-center gap-1.5 text-xs text-fg-subtle">
                <span className="w-2.5 h-0.5 rounded-full" style={{ background: colors.accent }} /> Output
              </span>
              <span className="flex items-center gap-1.5 text-xs text-fg-subtle">
                <span className="w-2.5 h-0.5 rounded-full" style={{ background: colors.neutral }} /> Input
              </span>
            </div>
          </div>

          {/* Donut charts */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Input vs Output */}
            <div className="bg-surface border border-line rounded-xl p-5">
              <h3 className="text-sm font-semibold font-display text-fg mb-1">Input vs Output</h3>
              <p className="text-xs text-fg-subtle mb-3">Token type split for the selected period</p>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Input', value: totals.input },
                      { name: 'Output', value: totals.output },
                    ]}
                    cx="50%" cy="50%"
                    innerRadius={56} outerRadius={80}
                    paddingAngle={totals.input > 0 && totals.output > 0 ? 3 : 0}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    <Cell fill={colors.neutral} fillOpacity={0.85} />
                    <Cell fill={colors.accent} fillOpacity={0.9} />
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-6 mt-1">
                {[
                  { label: 'Input', value: totals.input, color: colors.neutral },
                  { label: 'Output', value: totals.output, color: colors.accent },
                ].map(({ label, value, color }) => {
                  const pct = totals.tokens > 0 ? ((value / totals.tokens) * 100).toFixed(1) : '0.0'
                  return (
                    <div key={label} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="text-xs text-fg-subtle">{label}</span>
                      <span className="text-xs font-mono text-fg-muted">{formatTokens(value)}</span>
                      <span className="text-[10px] text-fg-subtle">({pct}%)</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Tokens by model pie */}
            <div className="bg-surface border border-line rounded-xl p-5">
              <h3 className="text-sm font-semibold font-display text-fg mb-1">Model distribution</h3>
              <p className="text-xs text-fg-subtle mb-3">Share of total tokens per model</p>
              {byModel.length === 0 ? (
                <div className="flex items-center justify-center h-[200px] text-xs text-fg-subtle">No data</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={byModel.map(m => ({ name: m.model, value: m.tokens }))}
                        cx="50%" cy="50%"
                        innerRadius={56} outerRadius={80}
                        paddingAngle={byModel.length > 1 ? 3 : 0}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {byModel.map((_, i) => (
                          <Cell key={i} fill={colors.series[i % colors.series.length]} fillOpacity={0.88} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-1.5 mt-1">
                    {byModel.slice(0, 5).map((m, i) => {
                      const pct = totals.tokens > 0 ? ((m.tokens / totals.tokens) * 100).toFixed(1) : '0.0'
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
          </div>

          {/* Model + key breakdown */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface border border-line rounded-xl p-5">
              <h3 className="text-sm font-semibold font-display text-fg mb-4">Tokens by model</h3>
              <ResponsiveContainer width="100%" height={Math.max(140, byModel.length * 44)}>
                <BarChart data={byModel} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: colors.tick }} axisLine={false} tickLine={false} tickFormatter={v => formatTokens(v)} />
                  <YAxis type="category" dataKey="model" tick={{ fontSize: 10, fill: colors.muted, fontFamily: 'Fira Code, monospace' }} axisLine={false} tickLine={false} width={130} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'transparent' }} />
                  <Bar dataKey="tokens" name="Tokens" radius={[0, 4, 4, 0]} maxBarSize={18}>
                    {byModel.map((_, i) => (
                      <Cell key={i} fill={colors.series[i % colors.series.length]} fillOpacity={0.9} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-surface border border-line rounded-xl p-5">
              <h3 className="text-sm font-semibold font-display text-fg mb-4">Top keys</h3>
              <div className="flex flex-col gap-3">
                {byKey.slice(0, 6).map(k => (
                  <div key={k.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-fg-muted truncate">
                        {keyLabel[k.id] ?? <span className="font-mono">{k.id.slice(0, 8)}...</span>}
                        <span className="text-fg-subtle ml-2">{emailByUserId[k.userId] ?? ''}</span>
                      </span>
                      <span className="text-xs font-mono text-fg-subtle flex-shrink-0 pl-3">
                        {formatTokens(k.tokens)} · {k.requests} req
                      </span>
                    </div>
                    <div className="h-1.5 bg-raised rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent transition-all duration-700"
                        style={{ width: `${(k.tokens / maxKeyTokens) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent requests */}
          <div className="mt-4 bg-surface border border-line rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-line flex items-center justify-between">
              <h3 className="text-sm font-semibold font-display text-fg">Recent requests</h3>
              <span className="text-xs text-fg-subtle">{rows.length.toLocaleString()} in range</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-raised/40">
                  {['Time', 'Model', 'Key', 'User'].map(h => (
                    <th key={h} className="px-5 py-2 text-left text-xs font-medium text-fg-subtle">{h}</th>
                  ))}
                  <th className="px-5 py-2 text-left text-xs font-medium text-fg-subtle">
                    Input<Hint text="Billed input tokens (full context). Hover a value to see how many were just the user's message." />
                  </th>
                  <th className="px-5 py-2 text-left text-xs font-medium text-fg-subtle">
                    Output<Hint text="Billed output tokens. Hover a value to see the model's reply content size." />
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 12).map(r => (
                  <tr key={r.id} className="border-b border-line/50 last:border-0 hover:bg-raised/40 transition-colors">
                    <td className="px-5 py-2.5 text-xs text-fg-subtle whitespace-nowrap" title={new Date(r.created_at).toLocaleString()}>
                      {new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-5 py-2.5 font-mono text-xs text-fg-muted">{r.model}</td>
                    <td className="px-5 py-2.5 text-xs text-fg-muted truncate max-w-[140px]">
                      {keyLabel[r.virtual_key_id] ?? <span className="font-mono">{r.virtual_key_id.slice(0, 8)}...</span>}
                    </td>
                    <td className="px-5 py-2.5 text-xs text-fg-subtle truncate max-w-[160px]">
                      {emailByUserId[r.user_id] ?? <span className="font-mono">{r.user_id.slice(0, 8)}</span>}
                    </td>
                    <td className="px-5 py-2.5 font-mono text-xs text-fg-subtle cursor-help" title={`${r.content_input_tokens ?? 0} tokens were the user's message`}>
                      {r.input_tokens.toLocaleString()}
                      <span className="text-fg-subtle/50"> · {(r.content_input_tokens ?? 0).toLocaleString()} sent</span>
                    </td>
                    <td className="px-5 py-2.5 font-mono text-xs text-accent cursor-help" title={`${r.content_output_tokens ?? 0} tokens were the model's reply text`}>
                      {r.output_tokens.toLocaleString()}
                      <span className="text-accent/50"> · {(r.content_output_tokens ?? 0).toLocaleString()} reply</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
