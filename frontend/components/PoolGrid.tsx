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
    <div className="bg-[#1E293B] rounded-xl border border-[#334155] p-4">
      <p className="text-[10px] font-medium text-[#64748B] uppercase tracking-widest mb-3">Sandbox pool</p>
      <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}>
        {cells.map((type, i) => (
          <div
            key={i}
            className={`aspect-square rounded-sm ${
              type === 'busy'
                ? 'bg-[#22C55E]'
                : type === 'warm'
                ? 'bg-[#22C55E]/30'
                : 'bg-[#1E293B] border border-[#334155]'
            }`}
          />
        ))}
      </div>
      <div className="flex items-center gap-5 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-[#22C55E]" />
          <span className="text-xs text-[#64748B]">Busy ({busy})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-[#22C55E]/30" />
          <span className="text-xs text-[#64748B]">Warm ({Math.max(warm, 0)})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm border border-[#334155]" />
          <span className="text-xs text-[#64748B]">Cold ({Math.max(cold, 0)})</span>
        </div>
      </div>
    </div>
  )
}
