'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { ThemeToggle } from '@/lib/theme'

const NAV_ITEMS = [
  {
    href: '/admin/config',
    label: 'Gateway',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.3" />
        <path d="M7 1.5v2M7 10.5v2M12.5 7h-2M3.5 7h-2M10.9 3.1l-1.4 1.4M4.5 9.5l-1.4 1.4M10.9 10.9l-1.4-1.4M4.5 4.5L3.1 3.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/admin/api-keys',
    label: 'API Keys',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="5" cy="6.5" r="3.2" stroke="currentColor" strokeWidth="1.3" />
        <path d="M7.8 8.5l4.2 3.7M10.7 10l1.4 1.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/admin/usage',
    label: 'Usage',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M1.5 11.5L5 7l2.8 2.8L12.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 4h3.5V7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.replace('/')
    }
  }, [user, router])

  return (
    <div className="flex flex-col h-screen bg-app">
      {/* Top nav */}
      <nav className="flex items-center gap-1 px-6 h-14 border-b border-line bg-app flex-shrink-0">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-xs text-fg-subtle hover:text-fg-muted transition-colors mr-3 cursor-pointer"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M8 2L4 6.5 8 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Dashboard
        </Link>

        <div className="w-px h-4 bg-line mr-3" />

        <span className="flex items-center gap-1.5 text-xs font-semibold text-fg mr-4">
          <span className="w-5 h-5 rounded-md bg-accent flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 18 18" fill="none">
              <path d="M3 13.5L9 3l6 10.5H3z" stroke="rgb(var(--accent-fg))" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </span>
          LLM Gateway
        </span>

        {NAV_ITEMS.map(item => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                active
                  ? 'bg-raised text-fg'
                  : 'text-fg-subtle hover:text-fg-muted hover:bg-raised/50'
              }`}
            >
              <span className={active ? 'text-accent' : ''}>{item.icon}</span>
              {item.label}
              {active && <span className="absolute -bottom-[13px] left-3 right-3 h-0.5 bg-accent rounded-full" />}
            </Link>
          )
        })}

        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />
          <span className="text-xs text-fg-subtle font-mono hidden sm:block">{user?.email}</span>
        </div>
      </nav>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
