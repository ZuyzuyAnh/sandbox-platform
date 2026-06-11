#!/usr/bin/env bash
# Test: PATCH /api/users/{user_id} — set token_limit and token_limit_window_minutes on a user.
# By default targets the admin user itself. Pass TARGET_EMAIL to target another user.
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-changeme}"
TARGET_EMAIL="${TARGET_EMAIL:-$ADMIN_EMAIL}"
TOKEN_LIMIT="${TOKEN_LIMIT:-10000}"
WINDOW_MINUTES="${WINDOW_MINUTES:-1440}"

# ── Colors ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
pass() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }
step() { echo -e "\n${CYAN}── $1${NC}"; }

# ── 1. Login ──────────────────────────────────────────────────────────────────
step "Login as admin ($ADMIN_EMAIL)"
LOGIN=$(curl -sf -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
[ -n "$TOKEN" ] && pass "Got JWT token" || fail "Login failed: $LOGIN"

# ── 2. List users and find target ─────────────────────────────────────────────
step "Find user: $TARGET_EMAIL"
USERS=$(curl -sf "$BASE_URL/api/users" \
  -H "Authorization: Bearer $TOKEN")

USER_ID=$(echo "$USERS" | python3 -c "
import sys, json
users = json.load(sys.stdin)
target = next((u for u in users if u['email'] == '$TARGET_EMAIL'), None)
if not target:
    print('', end='')
else:
    print(target['id'], end='')
")

[ -n "$USER_ID" ] && pass "Found user id: $USER_ID" || fail "User '$TARGET_EMAIL' not found"

# ── 3. PATCH token limit ───────────────────────────────────────────────────────
step "PATCH /api/users/$USER_ID — set token_limit=$TOKEN_LIMIT window=${WINDOW_MINUTES}h"
PATCH_RESP=$(curl -sf -X PATCH "$BASE_URL/api/users/$USER_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"token_limit\": $TOKEN_LIMIT, \"token_limit_window_minutes\": $WINDOW_MINUTES}")

echo "$PATCH_RESP" | python3 -m json.tool

python3 - <<EOF
import json, sys
data = json.loads('''$PATCH_RESP''')
assert data["token_limit"] == $TOKEN_LIMIT, f"token_limit mismatch: {data['token_limit']}"
assert data["token_limit_window_minutes"] == $WINDOW_MINUTES, f"window mismatch: {data['token_limit_window_minutes']}"
print("Assertions passed")
EOF

pass "Token limit set to $TOKEN_LIMIT tokens / ${WINDOW_MINUTES}h window"

# ── 4. Verify with GET ────────────────────────────────────────────────────────
step "Verify via GET /api/users"
UPDATED=$(curl -sf "$BASE_URL/api/users" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "
import sys, json
users = json.load(sys.stdin)
u = next((u for u in users if u['id'] == '$USER_ID'), None)
print(json.dumps(u, indent=2))
")

echo "$UPDATED"

python3 - <<EOF
import json
data = json.loads('''$UPDATED''')
assert data["token_limit"] == $TOKEN_LIMIT
assert data["token_limit_window_minutes"] == $WINDOW_MINUTES
print("GET verification passed")
EOF

pass "GET confirms token_limit=$TOKEN_LIMIT window=${WINDOW_MINUTES}h"

echo -e "\n${GREEN}All tests passed.${NC}"
echo -e "To clear the limit: TOKEN_LIMIT=null run this script (patch with null removes the limit)"
