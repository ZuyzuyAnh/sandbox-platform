'use client'

import ActiveSessions from '@/components/ActiveSessions'
import ActivityLog from '@/components/ActivityLog'
import MetricsBar from '@/components/MetricsBar'
import PoolGrid from '@/components/PoolGrid'
import SpawnPanel from '@/components/SpawnPanel'
import TaskTable from '@/components/TaskTable'

export default function Home() {
  return (
    <div className="flex flex-col h-screen">
      {/* Topbar */}
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <span className="text-base font-semibold text-gray-900">OpenSandbox</span>
        <span className="text-sm text-gray-500">Sandbox fleet overview</span>
        <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          All operational
        </span>
      </header>

      {/* Metrics */}
      <section className="px-6 py-3 flex-shrink-0">
        <MetricsBar />
      </section>

      {/* Pool grid */}
      <section className="px-6 pb-3 flex-shrink-0">
        <PoolGrid />
      </section>

      {/* Task table + Activity log */}
      <section className="flex flex-1 overflow-hidden gap-4 px-6 flex-col md:flex-row min-h-0">
        <div className="flex-1 overflow-hidden bg-white rounded-lg border border-gray-200 p-4 flex flex-col">
          <TaskTable onSelect={() => {}} selectedId={null} />
        </div>
        <div className="flex-1 overflow-hidden bg-white rounded-lg border border-gray-200 p-4 flex flex-col">
          <ActivityLog />
        </div>
      </section>

      <footer className="flex-shrink-0 border-t border-gray-200 bg-white px-6 py-3 flex flex-col gap-4">
        <ActiveSessions />
        <SpawnPanel />
      </footer>
    </div>
  )
}
