import type { VirtualApiKey, UsageSummary } from '@/types'

// ── Mock Virtual API Keys ───────────────────────────────────────────────────

export const MOCK_VIRTUAL_KEYS: VirtualApiKey[] = [
  {
    id: 'vk_001',
    name: 'Production - Claude Code',
    key_prefix: 'sk-vk-a1b2',
    user_id: 'u_001',
    user_email: 'alice@example.com',
    model_access: ['claude-sonnet-4-6', 'claude-haiku-4-5'],
    token_limit: 2_000_000,
    tokens_used: 1_243_880,
    is_active: true,
    created_at: '2026-05-01T08:00:00Z',
    last_used_at: '2026-06-10T11:42:00Z',
  },
  {
    id: 'vk_002',
    name: 'Dev - GPT-4o Testing',
    key_prefix: 'sk-vk-c3d4',
    user_id: 'u_002',
    user_email: 'bob@example.com',
    model_access: ['gpt-4o', 'gpt-4o-mini'],
    token_limit: 500_000,
    tokens_used: 498_120,
    is_active: true,
    created_at: '2026-05-15T10:00:00Z',
    last_used_at: '2026-06-10T09:15:00Z',
  },
  {
    id: 'vk_003',
    name: 'Research - Multi-model',
    key_prefix: 'sk-vk-e5f6',
    user_id: 'u_003',
    user_email: 'carol@example.com',
    model_access: ['claude-sonnet-4-6', 'gpt-4o', 'gemini-1.5-pro'],
    token_limit: null,
    tokens_used: 3_891_200,
    is_active: true,
    created_at: '2026-04-20T09:00:00Z',
    last_used_at: '2026-06-09T22:00:00Z',
  },
  {
    id: 'vk_004',
    name: 'CI Pipeline - Haiku',
    key_prefix: 'sk-vk-g7h8',
    user_id: 'u_001',
    user_email: 'alice@example.com',
    model_access: ['claude-haiku-4-5'],
    token_limit: 10_000_000,
    tokens_used: 2_100_000,
    is_active: true,
    created_at: '2026-05-20T12:00:00Z',
    last_used_at: '2026-06-10T10:58:00Z',
  },
  {
    id: 'vk_005',
    name: 'Old Staging Key',
    key_prefix: 'sk-vk-i9j0',
    user_id: 'u_004',
    user_email: 'dave@example.com',
    model_access: ['gpt-3.5-turbo'],
    token_limit: 100_000,
    tokens_used: 88_320,
    is_active: false,
    created_at: '2026-03-01T08:00:00Z',
    last_used_at: '2026-04-15T14:30:00Z',
  },
]

// ── Mock Usage Summary (last 30 days) ───────────────────────────────────────

function generateDailyData() {
  const days: { date: string; tokens_input: number; tokens_output: number; requests: number; cost_usd: number }[] = []
  const now = new Date('2026-06-10')
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const date = d.toISOString().slice(0, 10)
    const base = 120_000 + Math.random() * 180_000
    const weekend = d.getDay() === 0 || d.getDay() === 6
    const factor = weekend ? 0.4 : 1
    const tokens_input = Math.floor(base * 0.65 * factor)
    const tokens_output = Math.floor(base * 0.35 * factor)
    const requests = Math.floor((tokens_input + tokens_output) / 1800)
    const cost_usd = parseFloat(((tokens_input * 0.000003) + (tokens_output * 0.000015)).toFixed(4))
    days.push({ date, tokens_input, tokens_output, requests, cost_usd })
  }
  return days
}

export const MOCK_USAGE_SUMMARY: UsageSummary = {
  total_tokens: 11_433_200,
  total_requests: 6_352,
  total_cost_usd: 48.72,
  active_keys: 4,
  daily: generateDailyData(),
  by_model: [
    { model: 'claude-sonnet-4-6', tokens: 5_120_000, requests: 2_840, cost_usd: 22.15 },
    { model: 'claude-haiku-4-5', tokens: 2_100_000, requests: 1_890, cost_usd: 4.41 },
    { model: 'gpt-4o', tokens: 2_891_200, requests: 980, cost_usd: 17.35 },
    { model: 'gpt-4o-mini', tokens: 890_000, requests: 480, cost_usd: 2.14 },
    { model: 'gemini-1.5-pro', tokens: 432_000, requests: 162, cost_usd: 2.67 },
  ],
  by_user: [
    { user_email: 'carol@example.com', tokens: 3_891_200, requests: 2_100, cost_usd: 18.44 },
    { user_email: 'alice@example.com', tokens: 3_343_880, requests: 2_280, cost_usd: 15.92 },
    { user_email: 'bob@example.com', tokens: 2_498_120, requests: 1_380, cost_usd: 9.87 },
    { user_email: 'dave@example.com', tokens: 1_700_000, requests: 592, cost_usd: 4.49 },
  ],
}

export const AVAILABLE_MODELS = [
  'claude-sonnet-4-6',
  'claude-haiku-4-5',
  'claude-opus-4-8',
  'gpt-4o',
  'gpt-4o-mini',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
]
