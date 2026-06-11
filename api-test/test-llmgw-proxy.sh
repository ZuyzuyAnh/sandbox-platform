#!/usr/bin/env bash
# Test: llmgw proxy — simulates Claude Code inside a sandbox sending a request
# through /api/llmgw/v1/messages and verifies the response is valid Anthropic SSE.
#
# Flow:
#   1. Login → JWT token
#   2. Create virtual key  (as developer would)
#   3. POST /api/llmgw/v1/messages with virtual key  (as Claude Code would)
#   4. Verify Anthropic SSE event sequence
#   5. Verify token usage was recorded
#   6. Revoke virtual key (cleanup)
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-changeme}"

# ── Load backend/.env ────────────────────────────────────────────────────────
ENV_FILE="$(dirname "$0")/../backend/.env"
if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
else
  echo "Error: $ENV_FILE not found"; exit 1
fi
[ -n "${AZURE_API_KEY:-}" ] || { echo "Error: AZURE_API_KEY not set in backend/.env"; exit 1; }

# ── Colors ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
pass()  { echo -e "${GREEN}✓ $1${NC}"; }
fail()  { echo -e "${RED}✗ $1${NC}"; exit 1; }
step()  { echo -e "\n${CYAN}── $1${NC}"; }
info()  { echo -e "${YELLOW}  $1${NC}"; }

# ── 1. Login ─────────────────────────────────────────────────────────────────
step "Login as admin"
LOGIN=$(curl -sf -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
[ -n "$TOKEN" ] && pass "Got JWT token" || fail "Login failed: $LOGIN"

# ── 2. Create virtual key ─────────────────────────────────────────────────────
step "Create virtual key (simulating developer)"
KEY_RESP=$(curl -sf -X POST "$BASE_URL/api/llmgw/keys" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"label":"test-sandbox-key"}')

VIRTUAL_KEY=$(echo "$KEY_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['key'])")
KEY_ID=$(echo "$KEY_RESP"      | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
KEY_PREFIX=$(echo "$KEY_RESP"  | python3 -c "import sys,json; print(json.load(sys.stdin)['key_prefix'])")

[ -n "$VIRTUAL_KEY" ] && pass "Virtual key created: ${KEY_PREFIX}..." || fail "Key creation failed: $KEY_RESP"

# ── 3. Send message via virtual key (Claude Code simulation) ──────────────────
step "POST /api/llmgw/v1/messages (simulating Claude Code in sandbox)"
info "Model: claude-opus-4-7 → forwarded to Azure GPT-5"
info "x-api-key: ${KEY_PREFIX}..."
info "x-session-id: test-session-001"

SSE_FILE=$(mktemp)
HTTP_CODE=$(curl -s -o "$SSE_FILE" -w "%{http_code}" \
  -X POST "$BASE_URL/api/llmgw/v1/messages" \
  -H "x-api-key: $VIRTUAL_KEY" \
  -H "x-session-id: test-session-001" \
  -H "Content-Type: application/json" \
  --no-buffer \
  -d '{
    "model": "claude-opus-4-7",
    "messages": [{"role": "user", "content": "Reply with exactly one word: Hello"}],
    "max_tokens": 500,
    "stream": true
  }')

echo ""
info "HTTP status: $HTTP_CODE"
echo "── Raw SSE response ────────────────────────────────────"
cat "$SSE_FILE"
echo ""
echo "────────────────────────────────────────────────────────"

[ "$HTTP_CODE" = "200" ] && pass "Got HTTP 200" || fail "Expected 200, got $HTTP_CODE. Body: $(cat "$SSE_FILE")"

# ── 4. Verify Anthropic SSE event sequence ────────────────────────────────────
step "Verify Anthropic SSE event format"
python3 - "$SSE_FILE" <<'PYEOF'
import sys, json

sse_file = sys.argv[1]
with open(sse_file) as f:
    raw = f.read()

# Parse SSE events
events = []
for block in raw.strip().split("\n\n"):
    lines = block.strip().splitlines()
    event_type, data = None, None
    for line in lines:
        if line.startswith("event:"):
            event_type = line.split(":", 1)[1].strip()
        elif line.startswith("data:"):
            data = json.loads(line.split(":", 1)[1].strip())
    if event_type and data:
        events.append((event_type, data))

event_types = [e[0] for e in events]
print(f"  Events received: {event_types}")

required = ["message_start", "content_block_start", "content_block_stop", "message_delta", "message_stop"]
for req in required:
    assert req in event_types, f"Missing required event: {req}"
    print(f"  ✓ {req}")

# Verify message_start has message object
msg_start = next(d for t, d in events if t == "message_start")
assert "message" in msg_start, "message_start missing 'message'"
assert msg_start["message"]["role"] == "assistant", "role must be assistant"
print("  ✓ message_start structure valid")

# Verify at least one content delta
deltas = [d for t, d in events if t == "content_block_delta"]
assert len(deltas) > 0, "No content_block_delta events received"
text = "".join(d["delta"].get("text", "") for d in deltas)
print(f"  ✓ content received: '{text.strip()}'")

# Verify message_delta has usage
msg_delta = next(d for t, d in events if t == "message_delta")
assert "usage" in msg_delta, "message_delta missing usage"
assert msg_delta["usage"]["output_tokens"] > 0, "output_tokens must be > 0"
print(f"  ✓ output_tokens: {msg_delta['usage']['output_tokens']}")

print("\nAll SSE assertions passed")
PYEOF

pass "Anthropic SSE format is valid"

# ── 5. Verify token usage recorded ────────────────────────────────────────────
step "GET /api/llmgw/usage (verify token usage recorded)"
sleep 1  # allow DB write to complete
USAGE_RESP=$(curl -sf "$BASE_URL/api/llmgw/usage" \
  -H "Authorization: Bearer $TOKEN")

python3 - "$USAGE_RESP" "$KEY_ID" <<'PYEOF'
import sys, json

usage_list = json.loads(sys.argv[1])
key_id     = sys.argv[2]

# Find usage record for our virtual key
record = next((u for u in usage_list if u["virtual_key_id"] == key_id), None)
assert record, f"No usage record found for virtual_key_id={key_id}"
assert record["session_id"] == "test-session-001", f"session_id mismatch: {record['session_id']}"
assert record["input_tokens"] > 0,  f"input_tokens not recorded: {record['input_tokens']}"
assert record["output_tokens"] > 0, f"output_tokens not recorded: {record['output_tokens']}"
print(f"  ✓ session_id: {record['session_id']}")
print(f"  ✓ model:      {record['model']}")
print(f"  ✓ input_tokens:  {record['input_tokens']}")
print(f"  ✓ output_tokens: {record['output_tokens']}")
PYEOF

pass "Token usage correctly recorded"

# ── 6. Cleanup — revoke virtual key ───────────────────────────────────────────
step "Revoke virtual key (cleanup)"
curl -sf -X DELETE "$BASE_URL/api/llmgw/keys/$KEY_ID" \
  -H "Authorization: Bearer $TOKEN"
pass "Virtual key revoked"

rm -f "$SSE_FILE"
echo -e "\n${GREEN}All tests passed.${NC}"
