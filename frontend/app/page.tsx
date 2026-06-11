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
import { ThemeToggle } from '@/lib/theme'

export default function Home() {
  const { user, logout } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [groupsPanelOpen, setGroupsPanelOpen] = useState(false)
  const [userPanelOpen, setUserPanelOpen] = useState(false)

  return (
    <div className="flex flex-col h-screen bg-app">
      <PolicyChangeNotification />

      {/* Topbar */}
      <header className="flex items-center justify-between px-6 h-14 bg-app border-b border-line flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
              <path d="M3 13.5L9 3l6 10.5H3z" stroke="rgb(var(--accent-fg))" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-sm font-semibold font-display tracking-tight">Flezi sandbox</span>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <button
                onClick={() => { setUserPanelOpen(true); setGroupsPanelOpen(false) }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg text-fg-muted hover:text-fg hover:bg-raised transition-colors cursor-pointer"
              >
                Users
              </button>
              <button
                onClick={() => { setGroupsPanelOpen(true); setUserPanelOpen(false) }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg text-fg-muted hover:text-fg hover:bg-raised transition-colors cursor-pointer"
              >
                Groups
              </button>
              <Link
                href="/admin/config"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6h8M6 2v8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
                </svg>
                LLM Gateway
              </Link>
            </>
          )}
          <div className="w-px h-4 bg-line mx-1" />
          <ThemeToggle />
          <span className="text-xs text-fg-subtle hidden sm:block">{user?.email}</span>
          <button
            onClick={logout}
            className="px-3 py-1.5 text-xs font-medium rounded-lg text-fg-subtle hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </header>

      {isAdmin ? (
        /* ── Admin layout ────────────────────────────────────────── */
        <>
          <section className="px-6 pt-4 pb-2 flex-shrink-0 animate-rise" style={{ animationDelay: '0ms' }}>
            <MetricsBar />
          </section>

          <section className="px-6 py-2 flex-shrink-0 animate-rise" style={{ animationDelay: '60ms' }}>
            <PoolGrid />
          </section>

          <section className="flex flex-1 overflow-hidden px-6 py-2 min-h-0 animate-rise" style={{ animationDelay: '120ms' }}>
            <div className="flex-1 overflow-hidden bg-surface rounded-xl border border-line p-4 flex flex-col">
              <TaskTable onSelect={() => {}} selectedId={null} />
            </div>
          </section>

          <footer className="flex-shrink-0 border-t border-line bg-app px-6 py-4 flex flex-col gap-4 animate-rise" style={{ animationDelay: '180ms' }}>
            <AdminUsersOnline />
            <ActiveSessions />
            <SpawnPanel />
          </footer>
        </>
      ) : (
        /* ── User layout ─────────────────────────────────────────── */
        <section className="flex flex-1 overflow-hidden px-6 py-10 min-h-0 items-start justify-center">
          <div className="w-full max-w-2xl flex flex-col gap-6 animate-rise">
            <div className="bg-surface border border-line rounded-2xl p-6 flex flex-col gap-6">
              <div>
                <h1 className="text-lg font-semibold font-display tracking-tight mb-1">Your workspace</h1>
                <p className="text-sm text-fg-subtle">Spawn a VS Code session in an isolated sandbox.</p>
              </div>
              <ActiveSessions />
              <SpawnPanel />
            </div>
          </div>
        </section>
      )}

      {/* Admin panels */}
      {groupsPanelOpen && <AdminGroupsPanel onClose={() => setGroupsPanelOpen(false)} />}
      {userPanelOpen && <AdminUserPanel onClose={() => setUserPanelOpen(false)} />}
    </div>
  )
}
