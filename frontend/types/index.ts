export interface User {
  id: string
  email: string
  role: 'user' | 'admin'
}

export interface EgressRule {
  action: 'allow' | 'deny'
  target: string
}

export interface NetworkPolicy {
  defaultAction: 'deny' | 'allow'
  egress: EgressRule[]
}

export interface Group {
  id: string
  name: string
  description: string | null
  network_policy: NetworkPolicy
  member_count?: number
}

export interface GroupMember {
  id: string
  email: string
  role: string
}

export interface UserRecord {
  id: string
  email: string
  role: string
  is_active: boolean
  groups: string[]
}

export type SandboxStatus = 'running' | 'queued' | 'completed' | 'error'

export type Agent = 'Claude Code' | 'OpenAI Codex' | 'Qwen Code'

export type Runtime = 'python:3.12' | 'node:20' | 'java:21'

export interface Sandbox {
  id: string
  image: string
  status: SandboxStatus
  agent: string | null
  task: string | null
  cpu_percent: number | null
  memory_mb: number | null
  elapsed_seconds: number
  created_at: string | null
}

export interface PoolResponse {
  sandboxes: Sandbox[]
  total: number
  running: number
  queued: number
}

export interface Metrics {
  active_count: number
  completed_today: number
  avg_duration_seconds: number
}

export type EventType = 'started' | 'output' | 'completed' | 'error' | 'timeout' | 'thought' | 'tool_use' | 'code' | 'policy_changed'

export interface SandboxEvent {
  id: string
  sandbox_id: string
  event_type: EventType
  message: string
  agent: string | null
  timestamp: string
}

export interface ActivityResponse {
  events: SandboxEvent[]
}

export interface SpawnRequest {
  task: string
  agent: Agent
  image: Runtime
}

export interface SpawnResponse {
  sandbox_id: string
  status: string
  message: string
}

export interface OutputLine {
  id: string
  event_type: 'thought' | 'tool_use' | 'code' | 'output' | 'completed' | 'error'
  message: string
  timestamp: string
}

export interface SandboxOutputResponse {
  sandbox_id: string
  lines: OutputLine[]
}

export interface Session {
  sandbox_id: string
  session_url: string
  status: string
  created_at: string
  expires_at: string
  user_email?: string
}

export interface SessionListResponse {
  sessions: Session[]
  total: number
}

export interface LogLine {
  line: string
  ts: string
}

// ── Virtual API Keys ────────────────────────────────────────────────────────

export interface VirtualApiKey {
  id: string
  name: string
  key_prefix: string        // e.g. "sk-vk-abc1"
  user_id: string
  user_email: string
  model_access: string[]    // e.g. ["claude-3-5-sonnet", "gpt-4o"]
  token_limit: number | null
  tokens_used: number
  is_active: boolean
  created_at: string
  last_used_at: string | null
}

export interface CreateVirtualApiKeyRequest {
  name: string
  user_id: string
  model_access: string[]
  token_limit: number | null
}

// ── AI Usage Analytics ──────────────────────────────────────────────────────

export interface UsageDataPoint {
  date: string
  tokens_input: number
  tokens_output: number
  requests: number
  cost_usd: number
}

export interface UsageByModel {
  model: string
  tokens: number
  requests: number
  cost_usd: number
}

export interface UsageByUser {
  user_email: string
  tokens: number
  requests: number
  cost_usd: number
}

export interface UsageSummary {
  total_tokens: number
  total_requests: number
  total_cost_usd: number
  active_keys: number
  daily: UsageDataPoint[]
  by_model: UsageByModel[]
  by_user: UsageByUser[]
}
