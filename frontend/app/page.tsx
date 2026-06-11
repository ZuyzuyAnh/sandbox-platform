'use client'

import { useState } from 'react'
import Link from 'next/link'
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
      <header className="flex items-center justify-between px-6 py-3 bg-[#0F172A] border-b border-[#1E293B] flex-shrink-0">
        <span className="text-sm font-semibold text-[#F8FAFC] font-mono">Flezi sandbox</span>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <button
                onClick={() => { setUserPanelOpen(true); setGroupsPanelOpen(false) }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#334155] text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#F8FAFC] transition-colors cursor-pointer"
              >
                Users
              </button>
              <button
                onClick={() => { setGroupsPanelOpen(true); setUserPanelOpen(false) }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#334155] text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#F8FAFC] transition-colors cursor-pointer"
              >
                Groups
              </button>
              <Link
                href="/admin/api-keys"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[rgba(34,197,94,0.1)] text-[#22C55E] border border-[#22C55E]/20 hover:bg-[rgba(34,197,94,0.2)] transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="4.5" cy="5.5" r="3" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M7 7.5l3.5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                AI Admin
              </Link>
            </>
          )}
          <div className="w-px h-4 bg-[#334155] mx-1" />
          <span className="text-xs text-[#475569]">{user?.email}</span>
          <button
            onClick={logout}
            className="px-3 py-1.5 text-xs font-medium rounded-lg text-[#64748B] hover:text-[#EF4444] hover:bg-[rgba(239,68,68,0.1)] transition-colors cursor-pointer"
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
            <div className="flex-1 overflow-hidden bg-[#1E293B] rounded-xl border border-[#334155] p-4 flex flex-col">
              <TaskTable onSelect={() => {}} selectedId={null} />
            </div>
          </section>

          <footer className="flex-shrink-0 border-t border-[#1E293B] bg-[#0F172A] px-6 py-4 flex flex-col gap-4">
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
