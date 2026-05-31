'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User } from '@/types'

const TOKEN_KEY = 'auth_token'

interface AuthContextValue {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  isLoading: true,
  login: async () => {},
  logout: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const apiBase = () => {
    if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL?.trim()) {
      return process.env.NEXT_PUBLIC_API_URL.trim().replace(/\/$/, '')
    }
    if (typeof window !== 'undefined') return window.location.origin
    return 'http://localhost:8000'
  }

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    document.cookie = `${TOKEN_KEY}=; path=/; max-age=0`
    setToken(null)
    setUser(null)
    window.location.href = '/login'
  }, [])

  const applyToken = useCallback(async (t: string): Promise<boolean> => {
    try {
      const res = await fetch(`${apiBase()}/api/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
      })
      if (!res.ok) return false
      const u: User = await res.json()
      setToken(t)
      setUser(u)
      localStorage.setItem(TOKEN_KEY, t)
      document.cookie = `${TOKEN_KEY}=${t}; path=/; max-age=${8 * 3600}; SameSite=Strict`
      return true
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY)
    if (stored) {
      applyToken(stored).then((ok) => {
        if (!ok) {
          localStorage.removeItem(TOKEN_KEY)
          document.cookie = `${TOKEN_KEY}=; path=/; max-age=0`
        }
        setIsLoading(false)
      })
    } else {
      setIsLoading(false)
    }
  }, [applyToken])

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${apiBase()}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error((err as { detail?: string }).detail ?? 'Login failed')
    }
    const data = await res.json()
    const ok = await applyToken(data.access_token)
    if (!ok) throw new Error('Failed to validate token')
  }, [applyToken])

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
