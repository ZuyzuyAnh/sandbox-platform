# API Reference — OpenSandbox Dashboard

**Base URL (local dev):** `http://localhost:8000`  
**Base URL (production):** `https://<your-domain>` (nginx reverse-proxy, no port)

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Users](#2-users)
3. [Groups & Network Policy](#3-groups--network-policy)
4. [Sessions (VS Code Sandboxes)](#4-sessions-vs-code-sandboxes)
5. [Sandbox Pool & Metrics](#5-sandbox-pool--metrics)
6. [Real-time Events](#6-real-time-events)
7. [LLM Gateway](#7-llm-gateway)
8. [Token Rate Limiting](#8-token-rate-limiting)
9. [Error Responses](#9-error-responses)
10. [Frontend Integration Guide](#10-frontend-integration-guide)

---

## 1. Authentication

### JWT

Tokens are HS256 JWTs signed with `SECRET_KEY`. They expire after **8 hours**. There is no refresh endpoint — re-login when the token expires.

**JWT payload:**
```json
{ "sub": "<user_id>", "role": "user | admin", "exp": 1234567890 }
```

Store the token in memory or `sessionStorage`. Avoid `localStorage` for XSS reasons.

Include it on every protected request:
```
Authorization: Bearer <access_token>
```

---

### POST `/api/auth/login`

**Request**
```json
{ "email": "admin@example.com", "password": "changeme" }
```

**Response `200`**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "role": "admin"
}
```

**Errors**
- `401` — wrong email or password
- `403` — account is disabled

**Example**
```bash
curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"changeme"}' | jq .
```

---

### GET `/api/auth/me`

Returns identity of the token owner. Useful on page load to verify the token is still valid and get the user's role.

**Response `200`**
```json
{ "id": "a1b2c3d4-...", "email": "admin@example.com", "role": "admin" }
```

**Error** `401` — invalid or expired token.

---

## 2. Users

All user endpoints require **admin** role.

### User object

```json
{
  "id": "a1b2c3d4-0000-0000-0000-000000000000",
  "email": "user@example.com",
  "role": "user",
  "is_active": true,
  "groups": ["default"],
  "token_limit": 10000,
  "token_limit_window_minutes": 60
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | `string (uuid)` | Immutable |
| `email` | `string` | Unique |
| `role` | `"user" \| "admin"` | |
| `is_active` | `boolean` | `false` blocks login |
| `groups` | `string[]` | Group names the user belongs to |
| `token_limit` | `number \| null` | `null` = unlimited |
| `token_limit_window_minutes` | `number \| null` | `null` = unlimited |

---

### GET `/api/users`

List all users.

**Response `200`** — array of user objects.

```bash
curl -s http://localhost:8000/api/users \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

### POST `/api/users`

Create a user. New users are automatically added to the `default` group.

**Request**
```json
{
  "email": "newuser@example.com",
  "password": "secure-password",
  "role": "user"
}
```

**Response `201`** — user object (without password).

**Errors**
- `400` — email already registered, or invalid role

---

### PATCH `/api/users/{user_id}`

Update any combination of fields. Only fields present in the request body are changed.

**Request** (all fields optional)
```json
{
  "role": "admin",
  "is_active": false,
  "token_limit": 5000,
  "token_limit_window_minutes": 60
}
```

To **remove** a limit (make unlimited), send `null` explicitly:
```json
{ "token_limit": null, "token_limit_window_minutes": null }
```

**Response `200`** — updated user object.

**Errors**
- `404` — user not found
- `400` — invalid role value

---

### DELETE `/api/users/{user_id}`

Permanently deletes the user.

**Response `204`** — no body.

---

## 3. Groups & Network Policy

Groups define egress network policies that are enforced on sandbox containers. Every user is in at least the `default` group.

When a user belongs to multiple groups, their egress rules are **merged** (union of all `allow` rules across groups).

### Group object

```json
{
  "id": "uuid",
  "name": "engineers",
  "description": "Can reach GitHub and npm",
  "network_policy": {
    "defaultAction": "deny",
    "egress": [
      { "action": "allow", "target": "github.com" },
      { "action": "allow", "target": "registry.npmjs.org" }
    ]
  },
  "member_count": 4
}
```

---

### GET `/api/groups`

**Response `200`** — array of group objects.

---

### POST `/api/groups`

**Request**
```json
{
  "name": "engineers",
  "description": "GitHub + npm access",
  "network_policy": {
    "defaultAction": "deny",
    "egress": [
      { "action": "allow", "target": "github.com" }
    ]
  }
}
```

`network_policy` is optional — defaults to `{ "defaultAction": "deny", "egress": [] }`.

**Response `201`** — group object.

**Error** `400` — name already exists.

---

### PUT `/api/groups/{group_id}`

Rename or update description only. Does **not** update the network policy (use the `/policy` endpoint for that).

**Request** (both optional)
```json
{ "name": "senior-engineers", "description": "Updated description" }
```

**Error** `400` — cannot rename the `default` group.

---

### DELETE `/api/groups/{group_id}`

**Response `204`**.

**Error** `400` — cannot delete the `default` group.

---

### GET `/api/groups/{group_id}/members`

**Response `200`**
```json
[{ "id": "uuid", "email": "user@example.com", "role": "user" }]
```

---

### POST `/api/groups/{group_id}/members`

**Request**
```json
{ "user_id": "uuid" }
```

**Response `201`** `{ "status": "added" }`

**Error** `400` — user already in group.

---

### DELETE `/api/groups/{group_id}/members/{user_id}`

**Response `204`**.

---

### GET `/api/groups/{group_id}/policy`

Returns the raw network policy object:
```json
{
  "defaultAction": "deny",
  "egress": [{ "action": "allow", "target": "github.com" }]
}
```

---

### PUT `/api/groups/{group_id}/policy`

Replaces the network policy for a group.

**Request**
```json
{
  "defaultAction": "deny",
  "egress": [
    { "action": "allow", "target": "github.com" },
    { "action": "allow", "target": "api.anthropic.com" }
  ]
}
```

**Response `200`** — updated policy object.

> **Side effect:** All active sessions belonging to members of this group are **immediately terminated**. A `policy_changed` event is pushed to each affected user via WebSocket before termination. The frontend should listen for this event and redirect the user away from the sandbox view.

---

## 4. Sessions (VS Code Sandboxes)

A session is a live sandbox container running VS Code (code-server) assigned to a user. It expires after `SESSION_TTL_SECONDS` (default 30 min).

### Session object

```json
{
  "sandbox_id": "a1b2c3d4-0000-0000-0000-000000000000",
  "session_url": "http://localhost:40123/",
  "status": "active",
  "created_at": "2026-06-11T00:00:00.000Z",
  "expires_at": "2026-06-11T00:30:00.000Z",
  "user_email": "user@example.com"
}
```

`user_email` is only present in admin responses.

---

### POST `/api/sessions`

Creates and starts a session for the authenticated user. This call **blocks** until the sandbox is running and VS Code is reachable — typically 10–30 seconds. Show a loading state.

**Response `200`** — session object.

**Errors**
- `502` — OpenSandbox error (sandbox creation failed)
- `504` — sandbox or code-server did not become ready in time (60 s timeout each)

**Example**
```bash
curl -s -X POST http://localhost:8000/api/sessions \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Embedding the VS Code UI:**
```html
<iframe src="{session_url}" style="width:100%;height:100vh;border:none;" />
```

The `session_url` is already browser-reachable (host/port rewriting is done server-side).

---

### GET `/api/sessions`

List active sessions.

- Admins: all users' sessions, includes `user_email`
- Regular users: their own sessions only

**Response `200`**
```json
{
  "sessions": [ /* session objects */ ],
  "total": 2
}
```

---

### DELETE `/api/sessions/{sandbox_id}`

Terminate a session and destroy the container.

- Admins can terminate any session
- Users can only terminate their own

**Response `200`**
```json
{ "status": "terminated", "sandbox_id": "..." }
```

**Errors**
- `404` — session not found
- `403` — not your session

---

### GET `/api/sessions/{sandbox_id}/logs/stream`

Server-Sent Events stream of sandbox diagnostic logs (stdout/stderr from the container). Useful for showing startup progress or debugging.

**Auth:** SSE cannot send custom headers, so pass the JWT as a query parameter:
```
GET /api/sessions/{sandbox_id}/logs/stream?token=<jwt>
```

**Event format** — each SSE `data` line:
```json
{ "line": "Starting code-server...", "ts": "2026-06-11T00:00:01.000Z" }
```

Keep-alive comment lines (`: keep-alive`) are sent every ~10 seconds — ignore these.

**Errors** (also sent as data events):
```json
{ "error": "unauthorized" }
{ "error": "forbidden" }
{ "error": "sandbox_gone" }
```

**JavaScript example:**
```js
const es = new EventSource(
  `/api/sessions/${sandboxId}/logs/stream?token=${token}`
);
es.onmessage = (e) => {
  const data = JSON.parse(e.data);
  if (data.error === 'sandbox_gone') { es.close(); return; }
  appendLogLine(data.line);
};
```

---

## 5. Sandbox Pool & Metrics

### GET `/api/pool`

Live view of running/queued sandbox containers. Polled from OpenSandbox every few seconds.

- Admins: all sandboxes
- Users: only their own

**Response `200`**
```json
{
  "sandboxes": [
    {
      "id": "uuid",
      "image": "opensandbox/vscode-claude:latest",
      "status": "running",
      "agent": null,
      "task": null,
      "cpu_percent": 12.4,
      "memory_mb": 256.0,
      "elapsed_seconds": 42.0,
      "created_at": "2026-06-11T00:00:00.000Z"
    }
  ],
  "total": 1,
  "running": 1,
  "queued": 0
}
```

| Field | Notes |
|---|---|
| `status` | `"running"`, `"queued"`, `"error"`, `"terminated"` |
| `cpu_percent` | Live CPU usage — `null` if metrics unavailable |
| `memory_mb` | Live memory in MiB — `null` if metrics unavailable |
| `elapsed_seconds` | Seconds since sandbox first appeared in the poller |
| `agent` / `task` | Only set for legacy spawn-type sandboxes |

---

### GET `/api/metrics`

Summary stats for a dashboard header.

- Admins: platform-wide stats
- Users: their own sandboxes only

**Response `200`**
```json
{
  "active_count": 3,
  "completed_today": 12,
  "avg_duration_seconds": 284.5
}
```

`completed_today` counts spawn events since UTC midnight.

---

## 6. Real-time Events

### WebSocket `/api/events`

Streams sandbox lifecycle and output events in real time.

**Connection:**
```
ws://localhost:8000/api/events?token=<jwt>
```

Close code `4001` means authentication failed.

- Admins receive events for all sandboxes
- Users receive events for their own sandboxes only

**Message shape:**
```json
{
  "id": "uuid",
  "sandbox_id": "uuid",
  "event_type": "output",
  "message": "Text content of the event",
  "agent": "",
  "timestamp": "2026-06-11T00:00:00.000Z"
}
```

**`event_type` values:**

| Value | When | Action |
|---|---|---|
| `output` | Sandbox stdout/stderr line | Append to log view |
| `policy_changed` | Group network policy was updated, session terminated | Show alert, redirect user out of sandbox view |

**JavaScript example:**
```js
const ws = new WebSocket(`ws://localhost:8000/api/events?token=${token}`);

ws.onclose = (e) => {
  if (e.code === 4001) redirectToLogin();
  else scheduleReconnect(); // exponential backoff
};

ws.onmessage = (e) => {
  const event = JSON.parse(e.data);
  if (event.event_type === 'policy_changed') {
    showBanner(event.message);
    clearSandboxIframe();
  }
};
```

Implement reconnect with exponential backoff — the server does not push a reconnect signal.

---

### GET `/api/activity`

Last N events from Redis (non-streaming). Use this to populate the log view on initial page load before subscribing to the WebSocket.

**Response `200`**
```json
{
  "events": [ /* same shape as WebSocket messages */ ]
}
```

`N` is configured server-side (`ACTIVITY_LOG_MAX_EVENTS`, default 50).

---

### GET `/api/sandboxes/{sandbox_id}/output`

Full output history for one sandbox from Redis.

**Response `200`**
```json
{
  "sandbox_id": "uuid",
  "lines": [
    {
      "id": "uuid",
      "event_type": "output",
      "message": "log line",
      "timestamp": "2026-06-11T00:00:00.000Z"
    }
  ]
}
```

**Errors**
- `403` — not your sandbox (non-admin)

---

## 7. LLM Gateway

The gateway sits between Claude Code (inside the sandbox) and the actual LLM provider (Azure OpenAI, OpenAI, Anthropic). It authenticates requests using virtual keys, enforces token rate limits, and records usage.

### Architecture

```
Claude Code (sandbox)
  │  POST /api/llmgw/v1/messages
  │  x-api-key: sk-xxxxx  (virtual key)
  ▼
Backend (LLM Gateway)
  ├─ Authenticates virtual key
  ├─ Checks Redis rate limit
  ├─ Translates Anthropic → OpenAI format (LiteLLM)
  ├─ Proxies to configured LLM provider
  ├─ Streams response back as Anthropic SSE
  └─ Records token usage to DB + decrements Redis
```

The sandbox is pre-configured with:
```
ANTHROPIC_BASE_URL=http://host.docker.internal:8000/api/llmgw
```

Claude Code automatically picks up this env var and routes all requests through the gateway.

---

### Admin: LLM Configuration

#### GET `/api/llmgw/config` *(admin only)*

**Response `200`**
```json
{
  "provider": "azure",
  "endpoint_url": "https://your-resource.openai.azure.com/",
  "model_name": "gpt-5",
  "api_version": "2025-01-01-preview"
}
```

`api_key` is **never** returned.

---

#### PUT `/api/llmgw/config` *(admin only)*

**Request**
```json
{
  "provider": "azure",
  "endpoint_url": "https://your-resource.openai.azure.com/",
  "api_key": "xxxxxxxxxxxxxxxxxxxxxxxx",
  "model_name": "gpt-5",
  "api_version": "2025-01-01-preview"
}
```

| Field | Notes |
|---|---|
| `provider` | `"azure"`, `"openai"`, `"anthropic"` |
| `endpoint_url` | Provider API base URL |
| `api_key` | Written to DB — never returned in GET |
| `model_name` | Model identifier for the provider |
| `api_version` | Required for Azure, `null` for others |

**Response `200`** — config object (without `api_key`).

---

### Virtual Keys

Virtual keys are long-lived credentials issued to users. Claude Code inside the sandbox uses one to authenticate with the gateway. The full key is shown **once only** at creation time.

Key format: `sk-` followed by 64 hex characters. The first 12 characters (`key_prefix`) are safe to display in the UI.

---

#### POST `/api/llmgw/keys`

Create a virtual key for the authenticated user.

**Request**
```json
{ "label": "My sandbox key" }
```
`label` is optional but recommended for identification.

**Response `201`**
```json
{
  "id": "uuid",
  "key": "sk-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6",
  "key_prefix": "sk-a1b2c3d4",
  "label": "My sandbox key",
  "is_active": true,
  "created_at": "2026-06-11T00:00:00.000Z",
  "user_id": "uuid"
}
```

**Store the `key` value now — it cannot be retrieved again.**

---

#### GET `/api/llmgw/keys`

List keys. `key` field is never returned here — only `key_prefix`.

- Users: their own keys
- Admins: all users' keys

**Response `200`** — array of key objects (without `key`).

---

#### DELETE `/api/llmgw/keys/{key_id}`

Revoke a key (`is_active → false`). Existing requests in flight are not interrupted.

**Response `204`**.

**Errors**
- `403` — not your key (non-admin)
- `404` — key not found

---

### Proxy Endpoint

#### POST `/api/llmgw/v1/messages`

Anthropic Messages API compatible endpoint. Used by Claude Code inside sandboxes — **not typically called by the frontend directly.**

**Authentication:** virtual key, not JWT.
```
x-api-key: sk-a1b2c3d4...
```
or
```
Authorization: Bearer sk-a1b2c3d4...
```

**Optional session tracking header:**
```
x-session-id: <sandbox_id>
```
Links token usage records to the sandbox session, enabling per-session usage breakdowns.

**Request body:** standard [Anthropic Messages API](https://docs.anthropic.com/en/api/messages) format.

**Response:** Anthropic SSE stream (`text/event-stream`).

**Errors**
- `401` — missing or invalid virtual key
- `503` — LLM backend not configured by admin

> **Rate limit behaviour:** When a user has exhausted their quota, the endpoint still returns `200 OK` with `Content-Type: text/event-stream`. The response is a synthetic Anthropic SSE message containing:
> *"You have exhausted your token quota for this window. Please contact your administrator."*
> Claude Code receives this as a normal assistant reply — no error is thrown in the sandbox.

---

### Token Usage

#### GET `/api/llmgw/usage`

- Users: their own usage records
- Admins: all users' records

**Response `200`** — array, newest first:
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "virtual_key_id": "uuid",
    "session_id": "uuid | null",
    "model": "azure/gpt-5",
    "input_tokens": 1240,
    "output_tokens": 380,
    "created_at": "2026-06-11T00:00:00.000Z"
  }
]
```

**Aggregating for a usage chart:**
```js
const totalTokens = records.reduce(
  (sum, r) => sum + r.input_tokens + r.output_tokens, 0
);

// Per-user breakdown (admin only)
const byUser = records.reduce((acc, r) => {
  acc[r.user_id] = (acc[r.user_id] ?? 0) + r.input_tokens + r.output_tokens;
  return acc;
}, {});
```

---

## 8. Token Rate Limiting

Admins configure a per-user token budget via `PATCH /api/users/{user_id}`.

### Configuration

| Field | Type | Meaning |
|---|---|---|
| `token_limit` | `number \| null` | Max tokens (input + output) per window |
| `token_limit_window_minutes` | `number \| null` | Window duration in minutes |

**Both must be non-null to activate limiting.** If either is `null`, the user is unlimited and no Redis key is created.

**Set a limit:**
```bash
curl -s -X PATCH http://localhost:8000/api/users/<user_id> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"token_limit": 10000, "token_limit_window_minutes": 60}'
```

**Remove a limit:**
```bash
curl -s -X PATCH http://localhost:8000/api/users/<user_id> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"token_limit": null, "token_limit_window_minutes": null}'
```

---

### How the window works

The window is **rolling**, not fixed-clock. It starts the first time a user makes a request after a reset.

```
Redis key:  ratelimit:{user_id}
Value:      remaining tokens (decremented after each stream)
TTL:        window_minutes × 60 seconds
```

**Flow:**

1. Request arrives → backend reads Redis key
2. **Key exists, remaining > 0** → proxy to LLM, decrement after stream
3. **Key exists, remaining ≤ 0** → return synthetic "quota exhausted" SSE, no LLM call
4. **Key missing** (TTL expired = window reset, or first request):
   - Fetch `token_limit` from DB
   - If `null` → unlimited, proxy normally, no Redis write
   - If set → proxy normally, write new Redis key `(token_limit - tokens_used)` with TTL

Tokens counted = `input_tokens + output_tokens` from the actual LLM response.

---

### Displaying remaining tokens in the UI

The live remaining count is in Redis and not exposed via a dedicated API endpoint. To show an approximate remaining balance, calculate from usage records:

```js
// Approximate remaining = limit - sum of tokens used in the current window
const windowMs = user.token_limit_window_minutes * 60 * 1000;
const windowStart = Date.now() - windowMs;

const usedInWindow = usageRecords
  .filter(r => new Date(r.created_at).getTime() > windowStart)
  .reduce((sum, r) => sum + r.input_tokens + r.output_tokens, 0);

const remaining = user.token_limit != null
  ? Math.max(0, user.token_limit - usedInWindow)
  : null; // null = unlimited
```

> Note: this is approximate because the usage records reflect tokens from completed requests, while the Redis counter updates in real time. For display purposes this is accurate enough.

---

## 9. Error Responses

All errors use the same envelope:
```json
{ "detail": "Human-readable error message" }
```

| Status | Meaning |
|---|---|
| `400` | Bad request — validation error or business rule violation |
| `401` | Missing, invalid, or expired token |
| `403` | Authenticated but not authorized (wrong role or not your resource) |
| `404` | Resource not found |
| `502` | Upstream error from OpenSandbox or LLM provider |
| `503` | LLM gateway not configured — admin needs to set it up |
| `504` | Timeout — sandbox or code-server did not start in time |

---

## 10. Frontend Integration Guide

### Authentication flow

```
1. POST /api/auth/login  → store token + role
2. GET  /api/auth/me     → verify token on page load
3. On 401 anywhere       → clear token, redirect to login
4. After 8h              → token expires, re-login required
```

### Admin vs user views

Check `role` from the login response or `/api/auth/me`:

| Feature | `user` | `admin` |
|---|---|---|
| Create / view own sessions | ✓ | ✓ |
| View all users' sessions | — | ✓ |
| Manage users | — | ✓ |
| Manage groups | — | ✓ |
| Configure LLM backend | — | ✓ |
| View own token usage | ✓ | ✓ |
| View all token usage | — | ✓ |

### Recommended session page flow

```
1. GET /api/sessions        → does user have an active session?
2a. Yes → show iframe with session_url
2b. No  → show "Start Session" button
3. On click → POST /api/sessions (show spinner, ~10-30s)
4. On success → embed session_url in <iframe>
5. Connect WebSocket /api/events for live events
6. On `policy_changed` event → show alert, remove iframe, offer new session
7. On session expiry (compare expires_at to now) → show "Session expired" banner
```

### Virtual key workflow (for the LLM Keys settings page)

```
1. GET  /api/llmgw/keys          → list existing keys
2. POST /api/llmgw/keys          → create new key, display full key once with copy button
3. DELETE /api/llmgw/keys/{id}   → revoke
```

The full key value must be copied/saved at creation time. The UI should make this clear — show a warning alongside the key.

### Usage report page

```
1. GET /api/llmgw/usage          → token usage records
2. GET /api/users                → (admin) user list with limits
3. Cross-reference by user_id for per-user breakdown
4. Show bar/line chart of tokens over time, grouped by day
5. Show remaining quota per user using the approximation formula in §8
```
