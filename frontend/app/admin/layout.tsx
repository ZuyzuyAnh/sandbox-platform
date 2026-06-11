'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const NAV_ITEMS = [
  {
    href: '/admin/api-keys',
    label: 'API Keys',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <circle cx="5.5" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M8.5 9l4.5 4M11.5 10.5l1.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/admin/usage',
    label: 'Usage',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M1 12L5 7l3 3 3-4 3 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
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
    <div className="flex flex-col min-h-screen bg-[#0F172A]">
      {/* Top nav */}
      <nav className="flex items-center gap-1 px-6 py-3 border-b border-[#1E293B] bg-[#0F172A] sticky top-0 z-10">
        {/* Back to main dashboard */}
        <Link
          href="/"
          className="flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#94A3B8] transition-colors mr-4 cursor-pointer"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M8 2L4 6.5 8 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Dashboard
        </Link>

        <div className="w-px h-4 bg-[#334155] mr-3" />

        <span className="text-xs font-medium text-[#475569] mr-3">Admin</span>

        {NAV_ITEMS.map(item => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                active
                  ? 'bg-[#1E293B] text-[#F8FAFC] border border-[#334155]'
                  : 'text-[#64748B] hover:text-[#94A3B8] hover:bg-[#1E293B]/50'
              }`}
            >
              <span className={active ? 'text-[#22C55E]' : ''}>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}

        <div className="ml-auto text-xs text-[#334155] font-mono">
          {user?.email}
        </div>
      </nav>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
