'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { ThemeToggle } from '@/lib/theme'

type NavItem = { href: string; label: string; icon: React.ReactNode }

const IDENTITY: NavItem[] = [
  {
    href: '/admin/users',
    label: 'Users',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="5" r="2.6" stroke="currentColor" strokeWidth="1.3" />
        <path d="M3 13.5c0-2.5 2.2-4 5-4s5 1.5 5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/admin/groups',
    label: 'Groups',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
        <circle cx="5.5" cy="5.5" r="2.2" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="11" cy="6.5" r="1.8" stroke="currentColor" strokeWidth="1.3" />
        <path d="M1.5 13c0-2 1.8-3.2 4-3.2s4 1.2 4 3.2M10.2 9.9c2 .1 3.3 1.2 3.3 3.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
]

const GATEWAY: NavItem[] = [
  {
    href: '/admin/config',
    label: 'Gateway',
    icon: (
      <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.3" />
        <path d="M7 1.5v2M7 10.5v2M12.5 7h-2M3.5 7h-2M10.9 3.1l-1.4 1.4M4.5 9.5l-1.4 1.4M10.9 10.9l-1.4-1.4M4.5 4.5L3.1 3.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/admin/api-keys',
    label: 'API Keys',
    icon: (
      <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
        <circle cx="5" cy="6.5" r="3.2" stroke="currentColor" strokeWidth="1.3" />
        <path d="M7.8 8.5l4.2 3.7M10.7 10l1.4 1.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/admin/usage',
    label: 'Usage',
    icon: (
      <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
        <path d="M1.5 11.5L5 7l2.8 2.8L12.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 4h3.5V7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/admin/guardrails',
    label: 'Guardrails',
    icon: (
      <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
        <path d="M7 1l5 2.2v3.3c0 3.1-2.1 5.2-5 6.2-2.9-1-5-3.1-5-6.2V3.2L7 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    ),
  },
]

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={`relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
        active ? 'bg-raised text-fg' : 'text-fg-subtle hover:text-fg-muted hover:bg-raised/50'
      }`}
    >
      {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-accent" />}
      <span className={active ? 'text-accent' : ''}>{item.icon}</span>
      {item.label}
    </Link>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.replace('/dashboard')
    }
  }, [user, router])

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  // The per-user detail page is a standalone full-screen page (no console sidebar)
  // so admins clearly know they're configuring one specific user.
  const isUserDetail = /^\/admin\/users\/[^/]+$/.test(pathname)
  if (isUserDetail) {
    return <div className="h-screen overflow-auto bg-app">{children}</div>
  }

  return (
    <div className="flex h-screen bg-app">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 flex flex-col border-r border-line bg-app">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-5 h-14 border-b border-line flex-shrink-0">
          <span className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
            <svg width="13" height="13" viewBox="0 0 18 18" fill="none">
              <path d="M3 13.5L9 3l6 10.5H3z" stroke="rgb(var(--accent-fg))" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-sm font-semibold font-display tracking-tight text-fg">Admin Console</span>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">Identity</p>
            {IDENTITY.map(item => <NavLink key={item.href} item={item} active={isActive(item.href)} />)}
          </div>
          <div className="flex flex-col gap-1">
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">LLM Gateway</p>
            {GATEWAY.map(item => <NavLink key={item.href} item={item} active={isActive(item.href)} />)}
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-line px-3 py-3 flex flex-col gap-2 flex-shrink-0">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-fg-subtle hover:text-fg-muted hover:bg-raised/50 transition-colors cursor-pointer"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M8 2L4 6.5 8 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to dashboard
          </Link>
          <div className="flex items-center justify-between px-3">
            <span className="text-xs text-fg-subtle font-mono truncate" title={user?.email}>{user?.email}</span>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
