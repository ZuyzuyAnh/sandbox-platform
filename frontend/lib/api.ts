import { apiBase } from '@/lib/origin'
import {
  ActivityResponse,
  Group,
  GroupMember,
  LLMConfig,
  LLMConfigUpdate,
  Metrics,
  NetworkPolicy,
  PoolResponse,
  SandboxOutputResponse,
  Session,
  SessionListResponse,
  SpawnRequest,
  SpawnResponse,
  TokenUsage,
  User,
  UserRecord,
  VirtualKey,
  VirtualKeyCreated,
} from '@/types'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('auth_token')
}

function authHeaders(): HeadersInit {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init.headers ?? {}),
    },
  })
}

// ── Pool & Metrics ──────────────────────────────────────────────────────────

export async function fetchPool(): Promise<PoolResponse> {
  const res = await apiFetch(`${apiBase()}/api/pool`)
  if (!res.ok) throw new Error('Failed to fetch pool')
  return res.json()
}

export async function fetchMetrics(): Promise<Metrics> {
  const res = await apiFetch(`${apiBase()}/api/metrics`)
  if (!res.ok) throw new Error('Failed to fetch metrics')
  return res.json()
}

// ── Activity & Events ───────────────────────────────────────────────────────

export async function fetchActivity(): Promise<ActivityResponse> {
  const res = await apiFetch(`${apiBase()}/api/activity`)
  if (!res.ok) throw new Error('Failed to fetch activity')
  return res.json()
}

export async function fetchSandboxOutput(sandboxId: string): Promise<SandboxOutputResponse> {
  const res = await apiFetch(`${apiBase()}/api/sandboxes/${sandboxId}/output`)
  if (!res.ok) throw new Error('Failed to fetch output')
  return res.json()
}

// ── Spawn ───────────────────────────────────────────────────────────────────

export async function spawnSandbox(body: SpawnRequest): Promise<SpawnResponse> {
  const res = await apiFetch(`${apiBase()}/api/spawn`, {
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

// ── Session log streaming ────────────────────────────────────────────────────

export function sessionLogsStreamUrl(sandboxId: string, token: string): string {
  return `${apiBase()}/api/sessions/${sandboxId}/logs/stream?token=${encodeURIComponent(token)}`
}

// ── Sessions ────────────────────────────────────────────────────────────────

export async function createSession(): Promise<Session> {
  const res = await apiFetch(`${apiBase()}/api/sessions`, { method: 'POST' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail ?? 'Failed to create session')
  }
  return res.json()
}

export async function fetchSessions(): Promise<SessionListResponse> {
  const res = await apiFetch(`${apiBase()}/api/sessions`)
  if (!res.ok) throw new Error('Failed to fetch sessions')
  return res.json()
}

export async function terminateSession(sandboxId: string): Promise<void> {
  await apiFetch(`${apiBase()}/api/sessions/${sandboxId}`, { method: 'DELETE' })
}

// ── Admin: Users ────────────────────────────────────────────────────────────

export async function fetchUsers(): Promise<UserRecord[]> {
  const res = await apiFetch(`${apiBase()}/api/users`)
  if (!res.ok) throw new Error('Failed to fetch users')
  return res.json()
}

export async function createUser(email: string, password: string, role: string): Promise<UserRecord> {
  const res = await apiFetch(`${apiBase()}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, role }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail ?? 'Failed to create user')
  }
  return res.json()
}

export async function patchUser(id: string, data: { role?: string; is_active?: boolean }): Promise<UserRecord> {
  const res = await apiFetch(`${apiBase()}/api/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update user')
  return res.json()
}

export async function deleteUser(id: string): Promise<void> {
  await apiFetch(`${apiBase()}/api/users/${id}`, { method: 'DELETE' })
}

// ── Admin: Groups ───────────────────────────────────────────────────────────

export async function fetchGroups(): Promise<Group[]> {
  const res = await apiFetch(`${apiBase()}/api/groups`)
  if (!res.ok) throw new Error('Failed to fetch groups')
  return res.json()
}

export async function createGroup(name: string, description: string, network_policy: NetworkPolicy): Promise<Group> {
  const res = await apiFetch(`${apiBase()}/api/groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, network_policy }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail ?? 'Failed to create group')
  }
  return res.json()
}

export async function updateGroup(id: string, data: { name?: string; description?: string }): Promise<Group> {
  const res = await apiFetch(`${apiBase()}/api/groups/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update group')
  return res.json()
}

export async function deleteGroup(id: string): Promise<void> {
  await apiFetch(`${apiBase()}/api/groups/${id}`, { method: 'DELETE' })
}

export async function fetchGroupMembers(groupId: string): Promise<GroupMember[]> {
  const res = await apiFetch(`${apiBase()}/api/groups/${groupId}/members`)
  if (!res.ok) throw new Error('Failed to fetch group members')
  return res.json()
}

export async function addGroupMember(groupId: string, userId: string): Promise<void> {
  const res = await apiFetch(`${apiBase()}/api/groups/${groupId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail ?? 'Failed to add member')
  }
}

export async function removeGroupMember(groupId: string, userId: string): Promise<void> {
  await apiFetch(`${apiBase()}/api/groups/${groupId}/members/${userId}`, { method: 'DELETE' })
}

export async function fetchGroupPolicy(groupId: string): Promise<NetworkPolicy> {
  const res = await apiFetch(`${apiBase()}/api/groups/${groupId}/policy`)
  if (!res.ok) throw new Error('Failed to fetch group policy')
  return res.json()
}

export async function updateGroupPolicy(groupId: string, policy: NetworkPolicy): Promise<NetworkPolicy> {
  const res = await apiFetch(`${apiBase()}/api/groups/${groupId}/policy`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(policy),
  })
  if (!res.ok) throw new Error('Failed to update group policy')
  return res.json()
}

// ── LLM Gateway ─────────────────────────────────────────────────────────────

export async function fetchLLMConfig(): Promise<LLMConfig> {
  const res = await apiFetch(`${apiBase()}/api/llmgw/config`)
  if (!res.ok) throw new Error('Failed to fetch LLM config')
  return res.json()
}

export async function updateLLMConfig(body: LLMConfigUpdate): Promise<LLMConfig> {
  const res = await apiFetch(`${apiBase()}/api/llmgw/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail ?? 'Failed to update LLM config')
  }
  return res.json()
}

export async function fetchVirtualKeys(): Promise<VirtualKey[]> {
  const res = await apiFetch(`${apiBase()}/api/llmgw/keys`)
  if (!res.ok) throw new Error('Failed to fetch virtual keys')
  return res.json()
}

export async function createVirtualKey(label: string | null): Promise<VirtualKeyCreated> {
  const res = await apiFetch(`${apiBase()}/api/llmgw/keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail ?? 'Failed to create key')
  }
  return res.json()
}

export async function revokeVirtualKey(keyId: string): Promise<void> {
  const res = await apiFetch(`${apiBase()}/api/llmgw/keys/${keyId}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) throw new Error('Failed to revoke key')
}

export async function fetchTokenUsage(): Promise<TokenUsage[]> {
  const res = await apiFetch(`${apiBase()}/api/llmgw/usage`)
  if (!res.ok) throw new Error('Failed to fetch token usage')
  return res.json()
}
