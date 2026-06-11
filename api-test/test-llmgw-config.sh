#!/usr/bin/env bash
# Test: PUT /api/llmgw/config  then verify with GET /api/llmgw/config
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-changeme}"

# Load AZURE_API_KEY (and other vars) from backend/.env
ENV_FILE="$(dirname "$0")/../backend/.env"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
else
  echo "Warning: $ENV_FILE not found — AZURE_API_KEY may be unset"
fi

[ -n "${AZURE_API_KEY:-}" ] || { echo "Error: AZURE_API_KEY is not set in backend/.env"; exit 1; }

# ── Colors ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
pass() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }
step() { echo -e "\n${CYAN}── $1${NC}"; }

# ── 1. Login ──────────────────────────────────────────────────────────────────
step "Login as admin"
LOGIN=$(curl -sf -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
[ -n "$TOKEN" ] && pass "Got JWT token" || fail "Login failed: $LOGIN"

# ── 2. PUT /api/llmgw/config ──────────────────────────────────────────────────
step "PUT /api/llmgw/config"
PUT_BODY='{
  "provider": "azure",
  "endpoint_url": "https://aiworker-1770710959.openai.azure.com/",
  "api_key": "'"$AZURE_API_KEY"'",
  "model_name": "gpt-5",
  "api_version": "2025-01-01-preview"
}'

PUT_RESP=$(curl -sf -X PUT "$BASE_URL/api/llmgw/config" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$PUT_BODY")

echo "$PUT_RESP" | python3 -m json.tool
pass "Config updated"

# ── 3. GET /api/llmgw/config ─────────────────────────────────────────────────
step "GET /api/llmgw/config (verify)"
GET_RESP=$(curl -sf "$BASE_URL/api/llmgw/config" \
  -H "Authorization: Bearer $TOKEN")

echo "$GET_RESP" | python3 -m json.tool

# Assertions
python3 - <<EOF
import json, sys
data = json.loads('''$GET_RESP''')
assert data["provider"] == "azure",      f"provider mismatch: {data['provider']}"
assert "aiworker" in data["endpoint_url"], f"endpoint mismatch: {data['endpoint_url']}"
assert data["model_name"] == "gpt-5",   f"model mismatch: {data['model_name']}"
assert data["api_version"] == "2025-01-01-preview", f"api_version mismatch: {data['api_version']}"
assert "api_key" not in data,           "api_key must NOT be returned in GET response"
print("All assertions passed")
EOF

pass "GET config matches PUT values"
pass "api_key is not exposed in GET response"

echo -e "\n${GREEN}All tests passed.${NC}"
