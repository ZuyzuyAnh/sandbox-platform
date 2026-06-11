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

// ── LLM Gateway: config ─────────────────────────────────────────────────────

export interface LLMConfig {
  provider: string
  endpoint_url: string
  model_name: string
  api_version: string | null
}

export interface LLMConfigUpdate extends LLMConfig {
  api_key: string
}

// ── LLM Gateway: virtual keys ───────────────────────────────────────────────

export interface VirtualKey {
  id: string
  key_prefix: string
  label: string | null
  is_active: boolean
  created_at: string
  user_id: string
  /** Max total tokens (input + output). null = unlimited */
  token_limit: number | null
  tokens_used: number
  input_tokens: number
  output_tokens: number
  request_count: number
  last_used_at: string | null
  /** Distinct models requested with this key */
  models: string[]
}

export interface VirtualKeyUpdate {
  label?: string | null
  token_limit?: number | null
  is_active?: boolean
}

/** Returned once at creation — includes the full key. */
export interface VirtualKeyCreated extends VirtualKey {
  key: string
}

// ── LLM Gateway: token usage (one record per message) ───────────────────────

export interface TokenUsage {
  id: string
  user_id: string
  virtual_key_id: string
  session_id: string | null
  model: string
  input_tokens: number
  output_tokens: number
  created_at: string
}
