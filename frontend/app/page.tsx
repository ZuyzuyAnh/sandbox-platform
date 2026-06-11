'use client'

import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { ThemeToggle } from '@/lib/theme'

const FEATURES = [
  {
    title: 'Isolated sandboxes',
    desc: 'Every session runs in its own container with CPU, memory and lifetime limits. Nothing leaks between workspaces.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="3" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" />
        <rect x="7" y="7" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    title: 'VS Code in the browser',
    desc: 'One click spawns a full VS Code workspace — terminal, extensions, file tree — served straight from the sandbox.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M13 3l4 2v10l-4 2-7-5.5L3 13V7l3 1.5L13 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Claude Code pre-installed',
    desc: 'Each sandbox boots with the Claude Code CLI ready in the terminal, already authenticated against the gateway.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M4 6l4 4-4 4M10 14h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'LLM Gateway',
    desc: 'Bring your own provider — Azure OpenAI, OpenAI, Anthropic or OpenRouter. One endpoint, your keys stay server-side.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 2.5v3M10 14.5v3M17.5 10h-3M5.5 10h-3M15.3 4.7l-2.1 2.1M6.8 13.2l-2.1 2.1M15.3 15.3l-2.1-2.1M6.8 6.8L4.7 4.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Virtual API keys',
    desc: 'Issue revocable keys with per-key token limits. The real provider key is never exposed to any sandbox.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="7" cy="9" r="4.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M11 12l6 5M15 15.5l2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Usage analytics',
    desc: 'Token usage tracked per request, per key and per model — live charts in the dashboard plus exportable PNG reports.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 16l4.5-6 3.5 3.5L17 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13 6h4v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
]

const STEPS = [
  {
    n: '01',
    title: 'Configure the gateway',
    desc: 'An admin points the LLM gateway at your provider — endpoint, model and API key, stored server-side only.',
  },
  {
    n: '02',
    title: 'Spawn a sandbox',
    desc: 'Hit "New session" and get an isolated VS Code workspace in seconds, with a fresh virtual key injected automatically.',
  },
  {
    n: '03',
    title: 'Build with Claude Code',
    desc: 'Open the terminal, run claude, and ship. Every token is metered against your key — watch it live in Usage.',
  },
]

export default function LandingPage() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-app relative overflow-x-hidden">
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
        className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[420px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgb(var(--accent) / 0.16), transparent 65%)' }}
      />

      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav className="relative z-10 flex items-center justify-between px-6 lg:px-12 h-16 max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path d="M3 13.5L9 3l6 10.5H3z" stroke="rgb(var(--accent-fg))" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-base font-semibold font-display tracking-tight">Flezi sandbox</span>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          {user ? (
            <Link
              href="/dashboard"
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-accent text-accent-fg hover:bg-accent-hover active:scale-[0.98] transition-all"
            >
              Open dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-accent text-accent-fg hover:bg-accent-hover active:scale-[0.98] transition-all"
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 lg:px-12 pt-20 pb-16 text-center">
        <div className="animate-rise">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent/30 bg-accent/10 text-accent text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-dot" />
            AI coding sandboxes, self-hosted
          </span>
        </div>

        <h1
          className="font-display font-bold tracking-tight text-4xl sm:text-5xl lg:text-6xl leading-[1.08] mb-6 animate-rise"
          style={{ animationDelay: '60ms' }}
        >
          Spin up AI dev sandboxes
          <br />
          <span className="text-accent">in seconds, not hours.</span>
        </h1>

        <p
          className="max-w-2xl mx-auto text-base sm:text-lg text-fg-muted mb-10 animate-rise"
          style={{ animationDelay: '120ms' }}
        >
          Isolated VS Code workspaces with Claude Code pre-installed, metered through
          your own LLM gateway. Your provider keys never leave the server.
        </p>

        <div className="flex items-center justify-center gap-3 animate-rise" style={{ animationDelay: '180ms' }}>
          <Link
            href={user ? '/dashboard' : '/login'}
            className="px-6 py-3 text-sm font-semibold rounded-xl bg-accent text-accent-fg hover:bg-accent-hover active:scale-[0.98] transition-all shadow-lg shadow-accent/25"
          >
            {user ? 'Go to dashboard' : 'Get started'}
          </Link>
          <a
            href="#how-it-works"
            className="px-6 py-3 text-sm font-semibold rounded-xl border border-line text-fg-muted hover:text-fg hover:border-fg-subtle/50 transition-all"
          >
            How it works
          </a>
        </div>

        {/* Terminal mockup */}
        <div className="mt-16 max-w-3xl mx-auto animate-rise" style={{ animationDelay: '240ms' }}>
          <div className="rounded-2xl border border-line bg-surface shadow-2xl shadow-black/20 overflow-hidden text-left">
            <div className="flex items-center gap-1.5 px-4 h-9 border-b border-line bg-raised/60">
              <span className="w-2.5 h-2.5 rounded-full bg-danger/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-warn/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-ok/70" />
              <span className="ml-3 text-[11px] text-fg-subtle font-mono">sandbox — terminal</span>
            </div>
            <div className="p-5 font-mono text-[13px] leading-relaxed">
              <p><span className="text-ok">$</span> <span className="text-fg">claude &quot;add dark mode to the settings page&quot;</span></p>
              <p className="text-fg-subtle">✓ Authenticated via LLM gateway (virtual key)</p>
              <p className="text-fg-subtle">✓ Reading src/pages/settings.tsx ...</p>
              <p className="text-fg-muted">Editing 3 files — settings.tsx, theme.ts, globals.css</p>
              <p><span className="text-accent">▌</span> 2,431 tokens used · within key limit</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────── */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 lg:px-12 py-20">
        <div className="text-center mb-12">
          <h2 className="font-display font-bold tracking-tight text-2xl sm:text-3xl mb-3">
            Everything between your team and the model
          </h2>
          <p className="text-fg-muted max-w-xl mx-auto text-sm sm:text-base">
            A control plane for AI-assisted development: sandboxes, gateway, keys and analytics in one place.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="group bg-surface border border-line rounded-2xl p-6 hover:border-accent/40 hover:-translate-y-0.5 transition-all animate-rise"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <span className="inline-flex w-10 h-10 rounded-xl bg-accent/10 text-accent items-center justify-center mb-4 group-hover:bg-accent group-hover:text-accent-fg transition-colors">
                {f.icon}
              </span>
              <h3 className="text-sm font-semibold mb-1.5">{f.title}</h3>
              <p className="text-[13px] leading-relaxed text-fg-subtle">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────── */}
      <section id="how-it-works" className="relative z-10 max-w-6xl mx-auto px-6 lg:px-12 py-20">
        <div className="text-center mb-12">
          <h2 className="font-display font-bold tracking-tight text-2xl sm:text-3xl mb-3">How it works</h2>
          <p className="text-fg-muted text-sm sm:text-base">From zero to an AI-powered workspace in three steps.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {STEPS.map((s) => (
            <div key={s.n} className="relative bg-surface border border-line rounded-2xl p-6 overflow-hidden">
              <span className="absolute -top-3 -right-1 font-display font-bold text-[72px] leading-none text-accent/10 select-none">
                {s.n}
              </span>
              <span className="inline-block text-accent font-mono text-xs font-semibold mb-3">{s.n}</span>
              <h3 className="text-sm font-semibold mb-1.5">{s.title}</h3>
              <p className="text-[13px] leading-relaxed text-fg-subtle">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────── */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 lg:px-12 pb-24">
        <div className="relative rounded-3xl border border-accent/25 bg-surface overflow-hidden p-10 sm:p-14 text-center">
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at top, rgb(var(--accent) / 0.12), transparent 60%)' }}
          />
          <h2 className="relative font-display font-bold tracking-tight text-2xl sm:text-3xl mb-3">
            Ready to spawn your first sandbox?
          </h2>
          <p className="relative text-fg-muted text-sm sm:text-base mb-8 max-w-md mx-auto">
            Sign in with the account your admin provisioned and you&apos;re one click away from a workspace.
          </p>
          <Link
            href={user ? '/dashboard' : '/login'}
            className="relative inline-block px-7 py-3 text-sm font-semibold rounded-xl bg-accent text-accent-fg hover:bg-accent-hover active:scale-[0.98] transition-all shadow-lg shadow-accent/25"
          >
            {user ? 'Open dashboard' : 'Sign in to start'}
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-line">
        <div className="max-w-6xl mx-auto px-6 lg:px-12 h-16 flex items-center justify-between text-xs text-fg-subtle">
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-accent inline-flex items-center justify-center">
              <svg width="9" height="9" viewBox="0 0 18 18" fill="none">
                <path d="M3 13.5L9 3l6 10.5H3z" stroke="rgb(var(--accent-fg))" strokeWidth="2.4" strokeLinejoin="round" />
              </svg>
            </span>
            Flezi sandbox
          </span>
          <span>Self-hosted AI dev sandboxes</span>
        </div>
      </footer>
    </div>
  )
}
