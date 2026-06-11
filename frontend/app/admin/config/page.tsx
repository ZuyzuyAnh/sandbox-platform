'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { fetchLLMConfig, updateLLMConfig } from '@/lib/api'

const PROVIDERS = [
  { value: 'azure', label: 'Azure OpenAI', hint: 'Requires API version' },
  { value: 'openai', label: 'OpenAI', hint: 'api.openai.com or compatible' },
  { value: 'anthropic', label: 'Anthropic', hint: 'api.anthropic.com' },
  { value: 'openrouter', label: 'OpenRouter', hint: 'openrouter.ai' },
]

export default function GatewayConfigPage() {
  const [provider, setProvider] = useState('azure')
  const [endpointUrl, setEndpointUrl] = useState('')
  const [modelName, setModelName] = useState('')
  const [apiVersion, setApiVersion] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [configured, setConfigured] = useState(false)

  useEffect(() => {
    fetchLLMConfig()
      .then(cfg => {
        setProvider(cfg.provider)
        setEndpointUrl(cfg.endpoint_url)
        setModelName(cfg.model_name)
        setApiVersion(cfg.api_version ?? '')
        setConfigured(Boolean(cfg.endpoint_url))
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load config'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const cfg = await updateLLMConfig({
        provider,
        endpoint_url: endpointUrl.trim(),
        api_key: apiKey,
        model_name: modelName.trim(),
        api_version: apiVersion.trim() || null,
      })
      setConfigured(Boolean(cfg.endpoint_url))
      setApiKey('')
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save config')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="h-6 w-48 skeleton rounded mb-2" />
        <div className="h-4 w-72 skeleton rounded mb-8" />
        <div className="h-96 skeleton rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 animate-rise">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold font-display tracking-tight mb-1">Gateway configuration</h1>
          <p className="text-sm text-fg-subtle">
            The LLM backend that virtual keys proxy to via <code className="font-mono text-xs bg-raised px-1.5 py-0.5 rounded">/api/llmgw/v1/messages</code>.
          </p>
        </div>
        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
          configured ? 'bg-ok/15 text-ok' : 'bg-warn/15 text-warn'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${configured ? 'bg-ok' : 'bg-warn animate-pulse-dot'}`} />
          {configured ? 'Configured' : 'Not configured'}
        </span>
      </div>

      {/* Success panel — tells the admin what to do next */}
      {saved && (
        <div className="mb-6 bg-ok/10 border border-ok/25 rounded-2xl p-5 animate-rise">
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 rounded-full bg-ok/15 flex items-center justify-center flex-shrink-0">
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M4 10.5L8 14.5 16 6" stroke="rgb(var(--ok))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-fg mb-1">Gateway configured</h3>
              <p className="text-xs text-fg-muted mb-3">
                Requests through virtual keys now proxy to <span className="font-mono text-fg">{provider}/{modelName}</span>. Next steps:
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/admin/api-keys"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-accent text-accent-fg text-xs font-semibold hover:bg-accent-hover active:scale-[0.98] transition-all"
                >
                  Create API keys
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-line text-xs font-medium text-fg-muted hover:text-fg hover:bg-raised transition-colors"
                >
                  Spawn a sandbox
                </Link>
                <button
                  type="button"
                  onClick={() => setSaved(false)}
                  className="px-3 py-2 text-xs text-fg-subtle hover:text-fg-muted transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-surface border border-line rounded-2xl overflow-hidden">
        <div className="p-6 flex flex-col gap-5">
          {/* Provider */}
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-2">Provider</label>
            <div className="grid grid-cols-2 gap-2">
              {PROVIDERS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setProvider(p.value)}
                  className={`flex flex-col items-start px-3.5 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    provider === p.value
                      ? 'border-accent bg-accent/5 ring-1 ring-accent/30'
                      : 'border-line hover:border-fg-subtle/50'
                  }`}
                >
                  <span className={`text-sm font-medium ${provider === p.value ? 'text-accent' : 'text-fg'}`}>{p.label}</span>
                  <span className="text-[11px] text-fg-subtle mt-0.5">{p.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Endpoint */}
          <div>
            <label htmlFor="endpoint" className="block text-xs font-medium text-fg-muted mb-1.5">Endpoint URL</label>
            <input
              id="endpoint"
              value={endpointUrl}
              onChange={e => setEndpointUrl(e.target.value)}
              required
              type="url"
              placeholder="https://your-resource.openai.azure.com"
              className="w-full px-3 py-2.5 rounded-lg bg-app border border-line text-fg text-sm font-mono placeholder:text-fg-subtle placeholder:font-sans focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            />
          </div>

          {/* Model + API version */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="model" className="block text-xs font-medium text-fg-muted mb-1.5">Model name</label>
              <input
                id="model"
                value={modelName}
                onChange={e => setModelName(e.target.value)}
                required
                placeholder="gpt-5"
                className="w-full px-3 py-2.5 rounded-lg bg-app border border-line text-fg text-sm font-mono placeholder:text-fg-subtle placeholder:font-sans focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
              />
              <p className="text-[11px] text-fg-subtle mt-1">Sent to the backend as <code className="font-mono">{provider}/{modelName || 'model'}</code></p>
            </div>
            <div>
              <label htmlFor="apiver" className="block text-xs font-medium text-fg-muted mb-1.5">
                API version {provider === 'azure' ? <span className="text-danger">*</span> : <span className="text-fg-subtle">(optional)</span>}
              </label>
              <input
                id="apiver"
                value={apiVersion}
                onChange={e => setApiVersion(e.target.value)}
                required={provider === 'azure'}
                placeholder="2024-10-01-preview"
                className="w-full px-3 py-2.5 rounded-lg bg-app border border-line text-fg text-sm font-mono placeholder:text-fg-subtle placeholder:font-sans focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
              />
            </div>
          </div>

          {/* API key */}
          <div>
            <label htmlFor="apikey" className="block text-xs font-medium text-fg-muted mb-1.5">Provider API key</label>
            <div className="relative">
              <input
                id="apikey"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                required
                type={showKey ? 'text' : 'password'}
                autoComplete="off"
                placeholder={configured ? 'Enter key again to save changes' : 'sk-...'}
                className="w-full px-3 py-2.5 pr-10 rounded-lg bg-app border border-line text-fg text-sm font-mono placeholder:text-fg-subtle placeholder:font-sans focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                aria-label={showKey ? 'Hide key' : 'Show key'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg-muted transition-colors cursor-pointer"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 7s2.2-4 6-4 6 4 6 4-2.2 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.2" />
                  <circle cx="7" cy="7" r="1.6" fill="currentColor" />
                  {showKey && <path d="M2 2l10 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />}
                </svg>
              </button>
            </div>
            <p className="text-[11px] text-fg-subtle mt-1">
              Stored server-side and never returned by the API. Re-enter it whenever you save.
            </p>
          </div>

          {error && (
            <p role="alert" className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 animate-fade-in">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-line bg-raised/40">
          <p className="text-xs text-fg-subtle">
            Sandboxes authenticate with virtual keys, never this key.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-accent text-accent-fg text-sm font-semibold hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save configuration'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
