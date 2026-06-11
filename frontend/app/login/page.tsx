'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { ThemeToggle } from '@/lib/theme'

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
      window.location.href = '/'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-app relative overflow-hidden">
      {/* Decorative grid backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgb(var(--fg)) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--fg)) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      {/* Accent glow */}
      <div
        aria-hidden
        className="absolute -top-32 left-1/2 -translate-x-1/2 w-[560px] h-[280px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgb(var(--accent) / 0.14), transparent 65%)' }}
      />

      <div className="absolute top-5 right-5">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm relative animate-rise">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <span className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M3 13.5L9 3l6 10.5H3z" stroke="rgb(var(--accent-fg))" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="text-xl font-semibold font-display tracking-tight">Flezi sandbox</span>
          </div>
          <p className="text-sm text-fg-subtle">Sign in to your workspace</p>
        </div>

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
      </div>
    </div>
  )
}
