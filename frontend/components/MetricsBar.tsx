import { useMetrics } from '@/hooks/useMetrics'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}m ${s}s`
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="h-3 w-24 bg-gray-200 rounded animate-pulse mb-3" />
      <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mb-2" />
      <div className="h-3 w-32 bg-gray-200 rounded animate-pulse" />
    </div>
  )
}

export default function MetricsBar() {
  const { metrics, isLoading } = useMetrics()

  if (isLoading || !metrics) {
    return (
      <div className="grid grid-cols-2 gap-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active sandboxes</p>
        <p className="text-3xl font-bold text-gray-900 mt-1">{metrics.active_count}</p>
        <p className="text-xs text-gray-400 mt-1">Currently running or queued</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Avg duration</p>
        <p className="text-3xl font-bold text-gray-900 mt-1">{formatDuration(metrics.avg_duration_seconds)}</p>
        <p className="text-xs text-gray-400 mt-1">Across active sandboxes</p>
      </div>
    </div>
  )
}
