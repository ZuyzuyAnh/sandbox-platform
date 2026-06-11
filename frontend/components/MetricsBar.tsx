import { useMetrics } from '@/hooks/useMetrics'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}m ${s}s`
}

function SkeletonCard() {
  return (
    <div className="bg-[#1E293B] rounded-xl border border-[#334155] p-4">
      <div className="h-2.5 w-24 bg-[#334155] rounded animate-pulse mb-3" />
      <div className="h-8 w-16 bg-[#334155] rounded animate-pulse mb-2" />
      <div className="h-2.5 w-32 bg-[#334155] rounded animate-pulse" />
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
      <div className="bg-[#1E293B] rounded-xl border border-[#334155] p-4">
        <p className="text-[10px] font-medium text-[#64748B] uppercase tracking-widest">Active sandboxes</p>
        <p className="text-3xl font-bold font-mono text-[#F8FAFC] mt-1">{metrics.active_count}</p>
        <p className="text-xs text-[#475569] mt-1">Currently running or queued</p>
      </div>
      <div className="bg-[#1E293B] rounded-xl border border-[#334155] p-4">
        <p className="text-[10px] font-medium text-[#64748B] uppercase tracking-widest">Avg duration</p>
        <p className="text-3xl font-bold font-mono text-[#F8FAFC] mt-1">{formatDuration(metrics.avg_duration_seconds)}</p>
        <p className="text-xs text-[#475569] mt-1">Across active sandboxes</p>
      </div>
    </div>
  )
}
