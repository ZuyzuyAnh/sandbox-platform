#!/usr/bin/env bash
# View Redis rate limit records directly — no backend API call needed.
set -euo pipefail

REDIS=$(docker ps --filter name=redis -q | head -1)
[ -n "$REDIS" ] || { echo "No running Redis container found"; exit 1; }
r() { docker exec "$REDIS" redis-cli "$@"; }

CYAN='\033[0;36m'; NC='\033[0m'
step() { echo -e "\n${CYAN}── $1${NC}"; }

step "Scanning ratelimit:* keys"
KEYS=$(r --scan --pattern 'ratelimit:*')

if [ -z "$KEYS" ]; then
  echo "No rate limit records found in Redis."
  exit 0
fi

printf "\n%-45s  %-10s  %s\n" "KEY" "REMAINING" "TTL(sec)"
printf '%s\n' "$(printf '%.0s─' {1..70})"

while IFS= read -r key; do
  remaining=$(r GET "$key")
  ttl=$(r TTL "$key")
  printf "%-45s  %-10s  %s\n" "$key" "$remaining" "$ttl"
done <<< "$KEYS"
