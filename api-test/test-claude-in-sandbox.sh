#!/usr/bin/env bash
# Test: run claude -p inside the sandbox container via the LLM gateway.
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8000}"
GATEWAY_URL="http://192.168.127.254:8000/api/llmgw"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-changeme}"
PROMPT="${1:-Reply with exactly one word: Hello}"

GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
pass() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }
step() { echo -e "\n${CYAN}── $1${NC}"; }

# ── Find running sandbox container ───────────────────────────────────────────
step "Find sandbox container"
CONTAINER=$(podman ps --format "{{.Names}}" | grep '^sandbox-' | head -1)
[ -n "$CONTAINER" ] || fail "No running sandbox container found"
pass "Found: $CONTAINER"

# ── Create virtual key ────────────────────────────────────────────────────────
step "Create virtual key"
TOKEN=$(curl -sf -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

KEY_RESP=$(curl -sf -X POST "$BASE_URL/api/llmgw/keys" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"label":"sandbox-test-key"}')

VIRTUAL_KEY=$(echo "$KEY_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['key'])")
KEY_ID=$(echo "$KEY_RESP"      | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
pass "Virtual key created"

# ── Run claude inside container ───────────────────────────────────────────────
step "Running: claude -p \"$PROMPT\""
podman exec "$CONTAINER" /bin/sh -c "
  export ANTHROPIC_API_KEY=$VIRTUAL_KEY
  export ANTHROPIC_BASE_URL=$GATEWAY_URL
  claude -p \"$PROMPT\" --dangerously-skip-permissions
"

# ── Cleanup ───────────────────────────────────────────────────────────────────
step "Revoke virtual key"
curl -sf -X DELETE "$BASE_URL/api/llmgw/keys/$KEY_ID" \
  -H "Authorization: Bearer $TOKEN"
pass "Virtual key revoked"
