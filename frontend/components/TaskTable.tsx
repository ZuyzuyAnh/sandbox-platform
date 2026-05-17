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
  if (cpu >= 80) return 'bg-red-500'
  if (cpu >= 60) return 'bg-amber-500'
  return 'bg-emerald-500'
}

function agentDotColor(agent: string | null): string {
  if (agent === 'Claude Code') return 'bg-violet-500'
  if (agent === 'OpenAI Codex') return 'bg-blue-500'
  return 'bg-emerald-500'
}

function StatusBadge({ status }: { status: Sandbox['status'] }) {
  const cls =
    status === 'running'
      ? 'bg-emerald-100 text-emerald-800'
      : 'bg-amber-100 text-amber-800'
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
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
      <h2 className="text-sm font-semibold text-gray-700 mb-2">Active tasks</h2>
      {active.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
          No active sandboxes
        </div>
      ) : (
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
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
                    className={`border-b border-gray-50 transition-colors ${
                      isClickable ? 'cursor-pointer hover:bg-gray-50' : ''
                    } ${isSelected ? 'bg-violet-50 hover:bg-violet-50' : ''}`}
                  >
                    <td className="py-2 pr-4 max-w-[160px] truncate text-gray-800">
                      {sb.task ?? sb.id}
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${agentDotColor(sb.agent)}`} />
                      <span className="text-gray-700">{sb.agent ?? '—'}</span>
                    </td>
                    <td className="py-2 pr-4">
                      <StatusBadge status={sb.status} />
                    </td>
                    <td className="py-2 pr-4 w-28">
                      {sb.status === 'running' && sb.cpu_percent != null ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${cpuBarColor(sb.cpu_percent)}`}
                              style={{ width: `${Math.min(sb.cpu_percent, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-8 text-right">
                            {Math.round(sb.cpu_percent)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="py-2 text-gray-500 whitespace-nowrap">
                      {formatDuration(sb.elapsed_seconds)}
                    </td>
                    <td className="py-2 text-gray-400 text-xs">
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
