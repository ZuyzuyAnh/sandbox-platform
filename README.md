<div align="center">

# 🔶 Flezi Sandbox

**Self-hosted AI dev sandboxes — isolated VS Code workspaces with Claude Code pre-installed, metered through your own LLM gateway.**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-async-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-OpenSandbox-2496ED?logo=docker&logoColor=white)](https://www.docker.com)
[![Claude Code](https://img.shields.io/badge/Claude_Code-auto--installed-D97757?logo=anthropic&logoColor=white)](https://claude.com/claude-code)

*Spin up AI dev sandboxes in seconds, not hours.*

</div>

---

## ✨ What it does

One click spawns an **isolated VS Code workspace** running in a Docker sandbox. Each sandbox boots with the **Claude Code CLI installed and already authenticated** against your LLM gateway — open the terminal, type `claude`, and ship. Your real provider API keys never leave the server.

```
$ claude "add dark mode to the settings page"
✓ Authenticated via LLM gateway (virtual key)
✓ Reading src/pages/settings.tsx ...
▌ 2,431 tokens used · within key limit
```

## 🚀 Features

| | Feature | Description |
|---|---|---|
| 📦 | **Isolated sandboxes** | Every session runs in its own container with CPU, memory and TTL limits via [OpenSandbox](https://github.com/alibaba/OpenSandbox) |
| 💻 | **VS Code in the browser** | Full code-server workspace — terminal, extensions, file tree |
| 🤖 | **Claude Code pre-installed** | Native installer runs on session spawn; a per-session virtual key + gateway URL are injected automatically and revoked on terminate |
| 🔀 | **LLM Gateway** | Anthropic-format proxy (`/v1/messages`) that forwards to **Azure OpenAI / OpenAI / Anthropic / OpenRouter** via LiteLLM — streaming, tool calls, the works |
| 🔑 | **Virtual API keys** | Issue, edit, revoke, reactivate and delete keys; set **per-key token limits** enforced at the proxy (429 once exceeded) |
| 📊 | **Usage analytics** | Per-request token records, live charts (daily / by model / top keys), CSV export and **matplotlib PNG reports** |
| 🌐 | **Network policies** | Per-group egress rules merged into each sandbox's network policy |
| 🎨 | **Orange/black UI** | Light + dark mode, landing page, animated dashboard |

## 🏗 Architecture

```
                    ┌──────────────────────────────────────────────┐
                    │                  Browser                     │
                    │   Landing · Dashboard · Admin (Next.js 14)   │
                    └──────────────────┬───────────────────────────┘
                                       │ REST / SSE
                    ┌──────────────────▼───────────────────────────┐
                    │             FastAPI backend :8000            │
                    │  auth · sessions · pool · groups · llmgw     │
                    └───┬──────────────┬───────────────────┬───────┘
                        │              │                   │
              ┌─────────▼────┐  ┌──────▼───────┐   ┌───────▼────────┐
              │ PostgreSQL   │  │ OpenSandbox  │   │  LLM provider  │
              │ + Redis      │  │ server :8080 │   │ (Azure/OpenAI/ │
              └──────────────┘  └──────┬───────┘   │  Anthropic/…)  │
                                       │ Docker    └───────▲────────┘
                              ┌────────▼─────────┐         │
                              │  VS Code sandbox │   virtual key
                              │  code-server     │   ANTHROPIC_BASE_URL
                              │  + Claude Code ──┼─────────┘
                              └──────────────────┘
```

The gateway translates Anthropic Messages API requests to the configured provider and streams responses back as Anthropic SSE — so Claude Code works against **any** backend, with every request metered per virtual key.

## ⚡ Quickstart

**Prerequisites:** Docker Desktop, Python 3.12+ with [uv](https://docs.astral.sh/uv/), Node 20+

```bash
# 1. Infrastructure (OpenSandbox + Postgres + Redis)
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env          # adjust if needed
uv sync
uv run uvicorn main:app --reload --port 8000

# 3. Frontend
cd frontend
echo NEXT_PUBLIC_API_URL=http://localhost:8000 > .env.local
npm install
npm run dev
```

Open **http://localhost:3000** → sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `backend/.env` (default `admin@example.com` / `changeme`).

### First-run flow

1. **`/admin/config`** — point the gateway at your LLM provider (endpoint, model, API key — stored server-side, never returned)
2. **`+ New session`** in the top bar — an isolated VS Code workspace opens with a fresh virtual key injected
3. Open the integrated terminal and run **`claude`** — already authenticated, every token metered
4. **`/admin/usage`** — watch usage live, export CSV or a PNG chart report

## 🔧 Configuration

Key backend settings (`backend/.env` — see [.env.example](backend/.env.example) for all):

| Variable | Default | Purpose |
|---|---|---|
| `OPENSANDBOX_URL` | `http://localhost:8080` | OpenSandbox server API |
| `VSCODE_IMAGE` | `…/opensandbox/vscode:latest` | Image used for VS Code sessions |
| `SESSION_TTL_SECONDS` | `1800` | Sandbox lifetime |
| `SANDBOX_ANTHROPIC_BASE_URL` | `http://host.docker.internal:8000/api/llmgw` | Gateway URL injected into sandboxes |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `admin@example.com` / `changeme` | Seeded admin account |
| `ENABLE_NETWORK_POLICY` | `false` | Per-group egress policies (requires bridge networking) |

## 📡 API surface

| Endpoint | Auth | Description |
|---|---|---|
| `POST /api/sessions` | JWT | Spawn VS Code sandbox (+ auto virtual key, + Claude Code install) |
| `GET/DELETE /api/sessions[/{id}]` | JWT | List / terminate sessions (key revoked on terminate) |
| `GET/PUT /api/llmgw/config` | admin | LLM provider config |
| `POST/GET /api/llmgw/keys` | JWT | Create / list virtual keys (with usage detail) |
| `PATCH/DELETE /api/llmgw/keys/{id}` | JWT | Edit label & token limit, revoke/reactivate / delete |
| `GET /api/llmgw/usage` | JWT | Raw token usage records |
| `GET /api/llmgw/usage/report` | JWT | matplotlib PNG chart report |
| `POST /api/llmgw/v1/messages` | virtual key | Anthropic-format proxy (used by Claude Code) |

Interactive docs at **http://localhost:8000/docs**.

## 📁 Project structure

```
├── backend/            FastAPI — auth, sessions, pool, groups, LLM gateway
│   ├── routers/        API endpoints (llmgw.py = gateway + keys + usage)
│   ├── services/       OpenSandbox client, LiteLLM proxy, PNG reports
│   └── models/         SQLAlchemy models (virtual keys, token usage, …)
├── frontend/           Next.js 14 — landing, dashboard, admin
│   ├── app/            / (landing) · /dashboard · /admin/{config,api-keys,usage}
│   └── components/     SessionsPanel, SpawnPanel, PoolGrid, …
├── deploy/             OpenSandbox entrypoint, nginx, HTTPS setup
├── docker-compose.yaml Local dev infrastructure
└── DEPLOY.md           Production deployment guide
```

## 🛡 Security model

- **Provider API keys** live only in the backend database; the config API never returns them
- **Virtual keys** are stored as SHA-256 hashes — the full key is shown exactly once at creation
- Sandboxes authenticate with **revocable, rate-limitable virtual keys**, never the real key
- Session keys are **auto-revoked** when the session is terminated
- JWT auth for the dashboard; admin-only routes for gateway config and user management

---

<div align="center">
<sub>Built with FastAPI · Next.js · OpenSandbox · LiteLLM · recharts · matplotlib</sub>
</div>
