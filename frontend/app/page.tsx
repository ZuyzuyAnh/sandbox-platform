'use client'

import { useState } from 'react'
import ActiveSessions from '@/components/ActiveSessions'
import AdminGroupsPanel from '@/components/AdminGroupsPanel'
import AdminUserPanel from '@/components/AdminUserPanel'
import AdminUsersOnline from '@/components/AdminUsersOnline'
import MetricsBar from '@/components/MetricsBar'
import PolicyChangeNotification from '@/components/PolicyChangeNotification'
import PoolGrid from '@/components/PoolGrid'
import SpawnPanel from '@/components/SpawnPanel'
import TaskTable from '@/components/TaskTable'
import { useAuth } from '@/contexts/AuthContext'

export default function Home() {
  const { user, logout } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [groupsPanelOpen, setGroupsPanelOpen] = useState(false)
  const [userPanelOpen, setUserPanelOpen] = useState(false)

  return (
    <div className="flex flex-col h-screen">
      <PolicyChangeNotification />

      {/* Topbar */}
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <span className="text-base font-semibold text-gray-900">Flezi sandbox</span>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <>
              <button
                onClick={() => { setUserPanelOpen(true); setGroupsPanelOpen(false) }}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Users
              </button>
              <button
                onClick={() => { setGroupsPanelOpen(true); setUserPanelOpen(false) }}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Groups
              </button>
            </>
          )}
          <span className="text-xs text-gray-400">{user?.email}</span>
          <button
            onClick={logout}
            className="px-3 py-1.5 text-xs font-medium rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      {isAdmin ? (
        /* ── Admin layout ────────────────────────────────────────── */
        <>
          <section className="px-6 py-3 flex-shrink-0">
            <MetricsBar />
          </section>

          <section className="px-6 pb-3 flex-shrink-0">
            <PoolGrid />
          </section>

          <section className="flex flex-1 overflow-hidden px-6 min-h-0">
            <div className="flex-1 overflow-hidden bg-white rounded-lg border border-gray-200 p-4 flex flex-col">
              <TaskTable onSelect={() => {}} selectedId={null} />
            </div>
          </section>

          <footer className="flex-shrink-0 border-t border-gray-200 bg-white px-6 py-3 flex flex-col gap-4">
            <AdminUsersOnline />
            <ActiveSessions />
            <SpawnPanel />
          </footer>
        </>
      ) : (
        /* ── User layout ─────────────────────────────────────────── */
        <section className="flex flex-1 overflow-hidden px-6 py-8 min-h-0 items-start justify-center">
          <div className="w-full max-w-2xl flex flex-col gap-6">
            <ActiveSessions />
            <SpawnPanel />
          </div>
        </section>
      )}

      {/* Admin panels */}
      {groupsPanelOpen && <AdminGroupsPanel onClose={() => setGroupsPanelOpen(false)} />}
      {userPanelOpen && <AdminUserPanel onClose={() => setUserPanelOpen(false)} />}
    </div>
  )
}
