import { useMetrics } from '@/hooks/useMetrics'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}m ${s}s`
}

function SkeletonCard() {
  return (
    <div className="bg-surface rounded-xl border border-line p-4">
      <div className="h-2.5 w-24 skeleton rounded mb-3" />
      <div className="h-8 w-16 skeleton rounded mb-2" />
      <div className="h-2.5 w-32 skeleton rounded" />
    </div>
  )
}

export default function MetricsBar() {
  const { metrics, isLoading } = useMetrics()

  if (isLoading || !metrics) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-surface rounded-xl border border-line p-4 hover:border-fg-subtle/40 transition-colors">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${metrics.active_count > 0 ? 'bg-accent animate-pulse-dot' : 'bg-fg-subtle/40'}`} />
          <p className="text-[10px] font-medium text-fg-subtle uppercase tracking-widest">Active sandboxes</p>
        </div>
        <p className="text-3xl font-bold font-mono text-fg mt-1.5">{metrics.active_count}</p>
        <p className="text-xs text-fg-subtle mt-1">Currently running or queued</p>
      </div>
      <div className="bg-surface rounded-xl border border-line p-4 hover:border-fg-subtle/40 transition-colors">
        <p className="text-[10px] font-medium text-fg-subtle uppercase tracking-widest">Avg duration</p>
        <p className="text-3xl font-bold font-mono text-fg mt-2">{formatDuration(metrics.avg_duration_seconds)}</p>
        <p className="text-xs text-fg-subtle mt-1">Across active sandboxes</p>
      </div>
    </div>
  )
}
