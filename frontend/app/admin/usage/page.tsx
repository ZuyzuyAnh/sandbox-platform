'use client'

import { useState, useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { MOCK_USAGE_SUMMARY } from '@/lib/mock-ai-data'
import type { UsageDataPoint } from '@/types'

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const MODEL_COLORS: Record<string, string> = {
  'claude-sonnet-4-6': '#22C55E',
  'claude-haiku-4-5': '#3B82F6',
  'claude-opus-4-8': '#A855F7',
  'gpt-4o': '#F59E0B',
  'gpt-4o-mini': '#FB923C',
  'gemini-1.5-pro': '#06B6D4',
  'gemini-1.5-flash': '#84CC16',
}

function getModelColor(model: string) {
  return MODEL_COLORS[model] ?? '#64748B'
}

// ── Shared Tooltip ───────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1E293B] border border-[#334155] rounded-lg p-3 shadow-xl text-xs">
      <p className="text-[#94A3B8] mb-2 font-medium">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: p.color ?? p.fill }} />
          <span className="text-[#94A3B8]">{p.name}:</span>
          <span className="text-[#F8FAFC] font-mono ml-auto pl-3">
            {typeof p.value === 'number' && p.name?.toLowerCase().includes('token')
              ? formatTokens(p.value)
              : typeof p.value === 'number' && p.name?.toLowerCase().includes('cost')
              ? `$${p.value.toFixed(4)}`
              : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon, accent }: { label: string; value: string; sub?: string; icon: React.ReactNode; accent: string }) {
  return (
    <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-[#64748B]">{label}</p>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${accent}22`, color: accent }}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-semibold font-mono text-[#F8FAFC]">{value}</p>
      {sub && <p className="text-xs text-[#64748B] mt-1">{sub}</p>}
    </div>
  )
}

// ── Chart Card ───────────────────────────────────────────────────────────────

function ChartCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#F8FAFC]">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

// ── Export helper ─────────────────────────────────────────────────────────────

function exportCSV(data: UsageDataPoint[]) {
  const header = 'date,tokens_input,tokens_output,requests,cost_usd'
  const rows = data.map(d => `${d.date},${d.tokens_input},${d.tokens_output},${d.requests},${d.cost_usd}`)
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ai-usage-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Main Page ────────────────────────────────────────────────────────────────

type Range = '7d' | '14d' | '30d'

export default function UsagePage() {
  const [range, setRange] = useState<Range>('30d')
  const [metric, setMetric] = useState<'tokens' | 'requests' | 'cost'>('tokens')

  const summary = MOCK_USAGE_SUMMARY

  const dailySlice = useMemo(() => {
    const n = range === '7d' ? 7 : range === '14d' ? 14 : 30
    return summary.daily.slice(-n)
  }, [range, summary.daily])

  const chartData = useMemo(() => {
    return dailySlice.map(d => ({
      date: formatDate(d.date),
      'Input tokens': d.tokens_input,
      'Output tokens': d.tokens_output,
      Requests: d.requests,
      'Cost ($)': d.cost_usd,
    }))
  }, [dailySlice])

  return (
    <div className="min-h-screen bg-[#0F172A] p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[#F8FAFC] mb-1">AI Usage Analytics</h1>
          <p className="text-sm text-[#64748B]">Token consumption, request volume and cost breakdown across all keys.</p>
        </div>
        <button
          onClick={() => exportCSV(dailySlice)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1E293B] border border-[#334155] text-sm text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#475569] transition-colors cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Export CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Tokens"
          value={formatTokens(summary.total_tokens)}
          sub="Last 30 days"
          accent="#A855F7"
          icon={<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="4" width="13" height="7" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M5 7h5M5 9h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>}
        />
        <StatCard
          label="Total Requests"
          value={summary.total_requests.toLocaleString()}
          sub={`~${Math.round(summary.total_requests / 30)}/day avg`}
          accent="#3B82F6"
          icon={<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 4h11M2 7.5h11M2 11h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>}
        />
        <StatCard
          label="Total Cost"
          value={`$${summary.total_cost_usd.toFixed(2)}`}
          sub="Estimated spend"
          accent="#F59E0B"
          icon={<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.3"/><path d="M7.5 4v7M5.5 5.5h2.5a1.5 1.5 0 0 1 0 3H5.5h3a1.5 1.5 0 0 1 0 3H5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>}
        />
        <StatCard
          label="Active Keys"
          value={summary.active_keys.toString()}
          sub="Generating traffic"
          accent="#22C55E"
          icon={<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="5.5" cy="6.5" r="3" stroke="currentColor" strokeWidth="1.3"/><path d="M8 9l5 4M11 10l1.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>}
        />
      </div>

      {/* Range + metric selector */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1 bg-[#1E293B] border border-[#334155] rounded-lg p-1">
          {(['7d', '14d', '30d'] as Range[]).map(r => (
            <button key={r} onClick={() => setRange(r)} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${range === r ? 'bg-[#334155] text-[#F8FAFC]' : 'text-[#64748B] hover:text-[#94A3B8]'}`}>
              {r}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-[#1E293B] border border-[#334155] rounded-lg p-1">
          {([['tokens', 'Tokens'], ['requests', 'Requests'], ['cost', 'Cost']] as const).map(([m, label]) => (
            <button key={m} onClick={() => setMetric(m)} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${metric === m ? 'bg-[#334155] text-[#F8FAFC]' : 'text-[#64748B] hover:text-[#94A3B8]'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Main area chart */}
      <ChartCard title="Daily Usage Trend">
        <ResponsiveContainer width="100%" height={220}>
          {metric === 'tokens' ? (
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gradInput" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22C55E" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#22C55E" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gradOutput" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} interval={range === '7d' ? 0 : range === '14d' ? 1 : 4} />
              <YAxis tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={v => formatTokens(v)} width={46} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="Input tokens" stroke="#22C55E" strokeWidth={1.5} fill="url(#gradInput)" />
              <Area type="monotone" dataKey="Output tokens" stroke="#3B82F6" strokeWidth={1.5} fill="url(#gradOutput)" />
            </AreaChart>
          ) : metric === 'requests' ? (
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gradReq" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#A855F7" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#A855F7" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} interval={range === '7d' ? 0 : range === '14d' ? 1 : 4} />
              <YAxis tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="Requests" stroke="#A855F7" strokeWidth={1.5} fill="url(#gradReq)" />
            </AreaChart>
          ) : (
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gradCost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} interval={range === '7d' ? 0 : range === '14d' ? 1 : 4} />
              <YAxis tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v.toFixed(2)}`} width={46} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="Cost ($)" stroke="#F59E0B" strokeWidth={1.5} fill="url(#gradCost)" />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </ChartCard>

      {/* Bottom row: model breakdown + user breakdown */}
      <div className="grid grid-cols-2 gap-4 mt-4">
        {/* Model bar chart */}
        <ChartCard title="Tokens by Model">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={summary.by_model} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={v => formatTokens(v)} />
              <YAxis type="category" dataKey="model" tick={{ fontSize: 10, fill: '#94A3B8', fontFamily: 'Fira Code, monospace' }} axisLine={false} tickLine={false} width={120} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="tokens" radius={[0, 4, 4, 0]} name="Tokens">
                {summary.by_model.map((entry) => (
                  <Cell key={entry.model} fill={getModelColor(entry.model)} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* User donut */}
        <ChartCard title="Token Share by User">
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={180}>
              <PieChart>
                <Pie
                  data={summary.by_user}
                  dataKey="tokens"
                  nameKey="user_email"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={72}
                  strokeWidth={2}
                  stroke="#0F172A"
                >
                  {summary.by_user.map((_, i) => (
                    <Cell key={i} fill={['#22C55E', '#3B82F6', '#F59E0B', '#A855F7', '#06B6D4'][i % 5]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 flex flex-col gap-2">
              {summary.by_user.map((u, i) => {
                const color = ['#22C55E', '#3B82F6', '#F59E0B', '#A855F7', '#06B6D4'][i % 5]
                const pct = ((u.tokens / summary.total_tokens) * 100).toFixed(1)
                return (
                  <div key={u.user_email} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: color }} />
                    <span className="text-xs text-[#94A3B8] truncate flex-1">{u.user_email.split('@')[0]}</span>
                    <span className="text-xs font-mono text-[#64748B]">{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Detailed table */}
      <div className="mt-4 bg-[#1E293B] border border-[#334155] rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#334155] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#F8FAFC]">Per-Model Breakdown</h3>
          <span className="text-xs text-[#64748B]">Last 30 days</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#334155]">
              {['Model', 'Tokens', 'Requests', 'Cost', 'Share'].map(h => (
                <th key={h} className="px-5 py-2.5 text-left text-xs font-medium text-[#64748B]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary.by_model.map((m, i) => {
              const share = (m.tokens / summary.total_tokens) * 100
              return (
                <tr key={m.model} className={`border-b border-[#1E293B] hover:bg-[#0F172A]/40 transition-colors ${i % 2 === 1 ? 'bg-[#0F172A]/20' : ''}`}>
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-sm" style={{ background: getModelColor(m.model) }} />
                      <span className="font-mono text-xs text-[#F8FAFC]">{m.model}</span>
                    </div>
                  </td>
                  <td className="px-5 py-2.5 font-mono text-xs text-[#94A3B8]">{formatTokens(m.tokens)}</td>
                  <td className="px-5 py-2.5 font-mono text-xs text-[#94A3B8]">{m.requests.toLocaleString()}</td>
                  <td className="px-5 py-2.5 font-mono text-xs text-[#94A3B8]">${m.cost_usd.toFixed(2)}</td>
                  <td className="px-5 py-2.5 min-w-[120px]">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-[#334155] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${share}%`, background: getModelColor(m.model) }} />
                      </div>
                      <span className="text-[10px] font-mono text-[#64748B] w-8 text-right">{share.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
