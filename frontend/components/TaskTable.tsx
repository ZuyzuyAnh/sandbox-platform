import { usePool } from '@/hooks/usePool'
import { Sandbox } from '@/types'

interface TaskTableProps {
  onSelect: (sandbox: Sandbox) => void
  selectedId: string | null
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}m ${s < 10 ? '0' : ''}${s}s`
}

function cpuBarColor(cpu: number): string {
  if (cpu >= 80) return 'bg-[#EF4444]'
  if (cpu >= 60) return 'bg-[#F59E0B]'
  return 'bg-[#22C55E]'
}

function agentDotColor(agent: string | null): string {
  if (agent === 'Claude Code') return 'bg-[#A855F7]'
  if (agent === 'OpenAI Codex') return 'bg-[#3B82F6]'
  return 'bg-[#22C55E]'
}

function StatusBadge({ status }: { status: Sandbox['status'] }) {
  const cls =
    status === 'running'
      ? 'bg-[rgba(34,197,94,0.15)] text-[#22C55E]'
      : 'bg-[rgba(245,158,11,0.15)] text-[#F59E0B]'
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${cls}`}>
      {status}
    </span>
  )
}

export default function TaskTable({ onSelect, selectedId }: TaskTableProps) {
  const { pool } = usePool()

  const active = (pool?.sandboxes ?? []).filter(
    s => s.status === 'running' || s.status === 'queued'
  )

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-widest mb-3">Active tasks</h2>
      {active.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-[#475569]">
          No active sandboxes
        </div>
      ) : (
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[#475569] border-b border-[#334155]">
                <th className="pb-2 font-medium">Task</th>
                <th className="pb-2 font-medium">Agent</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">CPU</th>
                <th className="pb-2 font-medium">Time</th>
                <th className="pb-2 w-4" />
              </tr>
            </thead>
            <tbody>
              {active.map(sb => {
                const isSelected = sb.id === selectedId
                const isClickable = sb.status === 'running'
                return (
                  <tr
                    key={sb.id}
                    onClick={() => isClickable && onSelect(sb)}
                    className={`border-b border-[#1E293B] transition-colors ${
                      isClickable ? 'cursor-pointer hover:bg-[#334155]/30' : ''
                    } ${isSelected ? 'bg-[rgba(168,85,247,0.08)]' : ''}`}
                  >
                    <td className="py-2.5 pr-4 max-w-[160px] truncate text-[#F8FAFC] text-xs">
                      {sb.task ?? sb.id}
                    </td>
                    <td className="py-2.5 pr-4 whitespace-nowrap">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${agentDotColor(sb.agent)}`} />
                      <span className="text-[#94A3B8] text-xs">{sb.agent ?? '-'}</span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <StatusBadge status={sb.status} />
                    </td>
                    <td className="py-2.5 pr-4 w-28">
                      {sb.status === 'running' && sb.cpu_percent != null ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 bg-[#334155] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${cpuBarColor(sb.cpu_percent)}`}
                              style={{ width: `${Math.min(sb.cpu_percent, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-[#64748B] w-8 text-right">
                            {Math.round(sb.cpu_percent)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-[#334155]">-</span>
                      )}
                    </td>
                    <td className="py-2.5 text-xs font-mono text-[#64748B] whitespace-nowrap">
                      {formatDuration(sb.elapsed_seconds)}
                    </td>
                    <td className="py-2.5 text-[#22C55E] text-xs">
                      {isSelected && '›'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
