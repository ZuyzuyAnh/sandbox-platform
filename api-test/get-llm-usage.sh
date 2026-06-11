#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-changeme}"

TOKEN=$(curl -sf -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -sf "$BASE_URL/api/llmgw/usage" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "
import sys, json
records = json.load(sys.stdin)
if not records:
    print('No usage records found.')
    sys.exit(0)
print(f'{'ID':<36}  {'Model':<20}  {'In':>6}  {'Out':>6}  {'Session':<24}  Created')
print('-' * 110)
for r in records:
    print(f'{r[\"id\"]:<36}  {r[\"model\"]:<20}  {r[\"input_tokens\"]:>6}  {r[\"output_tokens\"]:>6}  {str(r.get(\"session_id\") or \"\"):<24}  {r[\"created_at\"]}')
print()
total_in  = sum(r['input_tokens']  for r in records)
total_out = sum(r['output_tokens'] for r in records)
print(f'Total records: {len(records)}  |  input_tokens: {total_in}  |  output_tokens: {total_out}')
"
