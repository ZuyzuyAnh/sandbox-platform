'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

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
    <div className="min-h-screen flex items-center justify-center bg-[#0F172A]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-lg font-semibold font-mono text-[#F8FAFC]">Flezi sandbox</span>
          <p className="text-sm text-[#475569] mt-1">Sign in to your account</p>
        </div>

        <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full px-3 py-2 rounded-lg bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-sm placeholder:text-[#475569] focus:outline-none focus:border-[#22C55E] transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-[#0F172A] border border-[#334155] text-[#F8FAFC] text-sm placeholder:text-[#475569] focus:outline-none focus:border-[#22C55E] transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-xs text-[#EF4444] bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#22C55E] text-[#0F172A] text-sm font-medium rounded-lg hover:bg-[#16A34A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer mt-1"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
