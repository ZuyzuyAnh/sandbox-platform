'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'dark',
  toggle: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const attr = document.documentElement.getAttribute('data-theme')
    if (attr === 'light' || attr === 'dark') setTheme(attr)
  }, [])

  const toggle = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      document.documentElement.setAttribute('data-theme', next)
      try { localStorage.setItem('theme', next) } catch {}
      return next
    })
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

/** Hex colors for SVG-based charts (recharts can't resolve CSS vars in attrs). */
export function useChartColors() {
  const { theme } = useTheme()
  if (theme === 'light') {
    return {
      grid: '#E4E2DF',
      tick: '#A8A29E',
      accent: '#EA580C',
      neutral: '#78716C',
      surface: '#FFFFFF',
      line: '#E4E2DF',
      fg: '#18181B',
      muted: '#57534E',
      series: ['#EA580C', '#F97316', '#FB923C', '#78716C', '#A8A29E'],
    }
  }
  return {
    grid: '#2C2C2C',
    tick: '#71717A',
    accent: '#F97316',
    neutral: '#A8A29E',
    surface: '#171717',
    line: '#2C2C2C',
    fg: '#FAFAFA',
    muted: '#A1A1AA',
    series: ['#F97316', '#FB923C', '#FDBA74', '#A8A29E', '#78716C'],
  }
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle theme"
      className={`w-8 h-8 flex items-center justify-center rounded-lg border border-line text-fg-muted hover:text-fg hover:bg-raised transition-colors cursor-pointer ${className}`}
    >
      {theme === 'dark' ? (
        /* Sun */
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.4" />
          <path d="M7 1v1.5M7 11.5V13M13 7h-1.5M2.5 7H1M11.2 2.8l-1 1M3.8 10.2l-1 1M11.2 11.2l-1-1M3.8 3.8l-1-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      ) : (
        /* Moon */
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M12 8.5A5.5 5.5 0 0 1 5.5 2 5.5 5.5 0 1 0 12 8.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}
