export type SandboxStatus = 'running' | 'queued' | 'completed' | 'error'

export type Agent = 'Claude Code' | 'OpenAI Codex' | 'Qwen Code'

export type Runtime = 'python:3.12' | 'node:20' | 'java:21'

export interface Sandbox {
  id: string
  image: string
  status: SandboxStatus
  agent: string | null
  task: string | null
  cpu_percent: number
  memory_mb: number
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
  security_incidents: number
}

export type EventType = 'started' | 'output' | 'completed' | 'error' | 'timeout' | 'thought' | 'tool_use' | 'code'

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
}

export interface SessionListResponse {
  sessions: Session[]
  total: number
}
