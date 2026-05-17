import { apiBase } from '@/lib/origin'
import { ActivityResponse, Metrics, PoolResponse, SandboxOutputResponse, Session, SessionListResponse, SpawnRequest, SpawnResponse } from '@/types'

export async function fetchPool(): Promise<PoolResponse> {
  const res = await fetch(`${apiBase()}/api/pool`)
  if (!res.ok) throw new Error('Failed to fetch pool')
  return res.json()
}

export async function fetchMetrics(): Promise<Metrics> {
  const res = await fetch(`${apiBase()}/api/metrics`)
  if (!res.ok) throw new Error('Failed to fetch metrics')
  return res.json()
}

export async function fetchActivity(): Promise<ActivityResponse> {
  const res = await fetch(`${apiBase()}/api/activity`)
  if (!res.ok) throw new Error('Failed to fetch activity')
  return res.json()
}

export async function spawnSandbox(body: SpawnRequest): Promise<SpawnResponse> {
  const res = await fetch(`${apiBase()}/api/spawn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail ?? 'Failed to spawn sandbox')
  }
  return res.json()
}

export async function fetchSandboxOutput(sandboxId: string): Promise<SandboxOutputResponse> {
  const res = await fetch(`${apiBase()}/api/sandboxes/${sandboxId}/output`)
  if (!res.ok) throw new Error('Failed to fetch output')
  return res.json()
}

export async function createSession(): Promise<Session> {
  const res = await fetch(`${apiBase()}/api/sessions`, { method: 'POST' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail ?? 'Failed to create session')
  }
  return res.json()
}

export async function fetchSessions(): Promise<SessionListResponse> {
  const res = await fetch(`${apiBase()}/api/sessions`)
  if (!res.ok) throw new Error('Failed to fetch sessions')
  return res.json()
}

export async function terminateSession(sandboxId: string): Promise<void> {
  await fetch(`${apiBase()}/api/sessions/${sandboxId}`, { method: 'DELETE' })
}
