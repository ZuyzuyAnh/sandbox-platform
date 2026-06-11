'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { ThemeToggle } from '@/lib/theme'

const HIGHLIGHTS = [
  'Isolated VS Code workspace in seconds',
  'Claude Code pre-installed and authenticated',
  'Token usage metered per virtual key',
]

export default function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      window.location.href = '/dashboard'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-app">
      {/* ── Left: brand panel ─────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col w-[46%] relative overflow-hidden border-r border-line">
        {/* Backdrop */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgb(var(--fg)) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--fg)) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />
        <div
          aria-hidden
          className="absolute -bottom-48 -left-32 w-[640px] h-[480px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, rgb(var(--accent) / 0.18), transparent 65%)' }}
        />

        <div className="relative flex flex-col h-full p-10 xl:p-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 w-fit cursor-pointer">
            <span className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <path d="M3 13.5L9 3l6 10.5H3z" stroke="rgb(var(--accent-fg))" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="text-base font-semibold font-display tracking-tight">Flezi sandbox</span>
          </Link>

          {/* Middle content */}
          <div className="flex-1 flex flex-col justify-center max-w-md">
            <h1 className="font-display font-bold tracking-tight text-3xl xl:text-4xl leading-[1.15] mb-4 animate-rise">
              Your AI workspace
              <br />
              <span className="text-accent">is one click away.</span>
            </h1>
            <p className="text-sm text-fg-muted mb-8 animate-rise" style={{ animationDelay: '60ms' }}>
              Sign in to spawn isolated sandboxes, manage virtual keys and watch token usage in real time.
            </p>

            <ul className="flex flex-col gap-3 mb-10 animate-rise" style={{ animationDelay: '120ms' }}>
              {HIGHLIGHTS.map(h => (
                <li key={h} className="flex items-center gap-3 text-sm text-fg-muted">
                  <span className="w-5 h-5 rounded-full bg-accent/12 flex items-center justify-center flex-shrink-0">
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6.5L4.5 9 10 3" stroke="rgb(var(--accent))" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {h}
                </li>
              ))}
            </ul>

            {/* Mini terminal */}
            <div className="rounded-xl border border-line bg-surface shadow-xl shadow-black/10 overflow-hidden animate-rise" style={{ animationDelay: '180ms' }}>
              <div className="flex items-center gap-1.5 px-3.5 h-8 border-b border-line bg-raised/60">
                <span className="w-2 h-2 rounded-full bg-danger/70" />
                <span className="w-2 h-2 rounded-full bg-warn/70" />
                <span className="w-2 h-2 rounded-full bg-ok/70" />
                <span className="ml-2 text-[10px] text-fg-subtle font-mono">sandbox — terminal</span>
              </div>
              <div className="px-4 py-3.5 font-mono text-[12px] leading-relaxed">
                <p><span className="text-ok">$</span> <span className="text-fg">claude &quot;fix the failing tests&quot;</span></p>
                <p className="text-fg-subtle">✓ Authenticated via LLM gateway</p>
                <p><span className="text-accent">▌</span> <span className="text-fg-muted">Running 4 tools...</span></p>
              </div>
            </div>
          </div>

          <p className="relative text-xs text-fg-subtle">Self-hosted AI dev sandboxes</p>
        </div>
      </div>

      {/* ── Right: form ───────────────────────────────────────────── */}
      <div className="flex-1 relative flex items-center justify-center p-6">
        {/* Mobile-only backdrop */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.04] pointer-events-none lg:hidden"
          style={{
            backgroundImage:
              'linear-gradient(rgb(var(--fg)) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--fg)) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div
          aria-hidden
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[560px] h-[280px] rounded-full pointer-events-none lg:hidden"
          style={{ background: 'radial-gradient(ellipse, rgb(var(--accent) / 0.14), transparent 65%)' }}
        />

        {/* Top-right controls */}
        <div className="absolute top-5 right-5 flex items-center gap-2">
          <ThemeToggle />
        </div>
        <Link
          href="/"
          className="absolute top-5 left-5 flex items-center gap-1.5 text-xs text-fg-subtle hover:text-fg-muted transition-colors cursor-pointer"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M8 2L4 6.5 8 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Home
        </Link>

        <div className="w-full max-w-sm relative animate-rise">
          {/* Mobile brand */}
          <div className="text-center mb-8 lg:hidden">
            <div className="inline-flex items-center gap-2.5 mb-3">
              <span className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M3 13.5L9 3l6 10.5H3z" stroke="rgb(var(--accent-fg))" strokeWidth="1.8" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="text-xl font-semibold font-display tracking-tight">Flezi sandbox</span>
            </div>
          </div>

          <div className="mb-7 hidden lg:block">
            <h2 className="text-2xl font-semibold font-display tracking-tight mb-1.5">Welcome back</h2>
            <p className="text-sm text-fg-subtle">Sign in with the account your admin provisioned.</p>
          </div>
          <p className="text-sm text-fg-subtle text-center mb-6 lg:hidden">Sign in to your workspace</p>

          <div className="bg-surface border border-line rounded-2xl p-6 shadow-xl shadow-black/5">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-fg-muted mb-1.5">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                  className="w-full px-3 py-2.5 rounded-lg bg-app border border-line text-fg text-sm placeholder:text-fg-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-medium text-fg-muted mb-1.5">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full px-3 py-2.5 rounded-lg bg-app border border-line text-fg text-sm placeholder:text-fg-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p role="alert" className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 animate-fade-in">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-accent text-accent-fg text-sm font-semibold rounded-lg hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer mt-1"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-fg-subtle mt-5">
            No account? Ask your administrator to create one.
          </p>
        </div>
      </div>
    </div>
  )
}
