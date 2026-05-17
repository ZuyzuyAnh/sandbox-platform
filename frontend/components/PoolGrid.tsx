import { usePool } from '@/hooks/usePool'

const TOTAL_CELLS = 32

export default function PoolGrid() {
  const { pool } = usePool()

  const busy = pool?.running ?? 0
  const warm = Math.min((pool?.total ?? 0) - busy, 8)
  const cold = TOTAL_CELLS - busy - warm

  const cells = [
    ...Array(busy).fill('busy'),
    ...Array(Math.max(warm, 0)).fill('warm'),
    ...Array(Math.max(cold, 0)).fill('cold'),
  ]

  return (
    <div>
      <div className="grid grid-cols-16 gap-1" style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}>
        {cells.map((type, i) => (
          <div
            key={i}
            className={`aspect-square rounded-sm border ${
              type === 'busy'
                ? 'bg-emerald-200 border-emerald-400'
                : type === 'warm'
                ? 'bg-green-100 border-green-300'
                : 'bg-gray-100 border-gray-200'
            }`}
          />
        ))}
      </div>
      <div className="flex items-center gap-6 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-emerald-200 border border-emerald-400" />
          <span className="text-xs text-gray-500">Busy ({busy})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-green-100 border border-green-300" />
          <span className="text-xs text-gray-500">Warm ({Math.max(warm, 0)})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-200" />
          <span className="text-xs text-gray-500">Cold ({Math.max(cold, 0)})</span>
        </div>
      </div>
    </div>
  )
}
