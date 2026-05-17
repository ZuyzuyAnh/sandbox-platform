#!/usr/bin/env bash
# Obtain a free Let's Encrypt certificate and switch nginx to HTTPS.
# Prerequisites: a domain name (A record) pointing to this EC2 instance.
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: sudo $0 <your-domain.com>"
  echo "Example: sudo $0 sandbox.example.com"
  exit 1
fi

DOMAIN="$1"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Installing certbot (Amazon Linux 2023)"
dnf install -y certbot

echo "==> Stopping nginx container so certbot can use port 80"
docker compose -f docker-compose.prod.yaml --env-file .env.production stop nginx || true

mkdir -p /var/www/certbot

echo "==> Requesting certificate for ${DOMAIN}"
certbot certonly --standalone \
  --preferred-challenges http \
  -d "${DOMAIN}" \
  --non-interactive \
  --agree-tos \
  --register-unsafely-without-email

echo "==> Installing nginx SSL config"
sed "s/YOUR_DOMAIN/${DOMAIN}/g" deploy/nginx-ssl.conf > "/tmp/nginx-${DOMAIN}.conf"

echo "==> Update .env.production (manual check recommended)"
grep -q "OPENSANDBOX_SESSION_EIP" .env.production && \
  sed -i "s/^OPENSANDBOX_SESSION_EIP=.*/OPENSANDBOX_SESSION_EIP=${DOMAIN}/" .env.production || true

echo ""
echo "Next steps (run from ${REPO_ROOT}):"
echo "  1. Edit docker-compose.prod.yaml nginx service to add:"
echo "       ports: ['80:80', '443:443']"
echo "       volumes:"
echo "         - /tmp/nginx-${DOMAIN}.conf:/etc/nginx/conf.d/default.conf:ro"
echo "         - /etc/letsencrypt:/etc/letsencrypt:ro"
echo "         - /var/www/certbot:/var/www/certbot:ro"
echo "  2. Set backend/.env.production:"
echo "       OPENSANDBOX_SESSION_HOST=${DOMAIN}"
echo "       CORS_ORIGINS=https://${DOMAIN}"
echo "  3. Leave NEXT_PUBLIC_API_URL and NEXT_PUBLIC_WS_URL empty in .env.production (same-origin)"
echo "  4. Recreate opensandbox + rebuild frontend:"
echo "       docker compose -f docker-compose.prod.yaml --env-file .env.production up -d --force-recreate opensandbox"
echo "       docker compose -f docker-compose.prod.yaml --env-file .env.production up -d --build frontend nginx"
echo ""
echo "Certificate files:"
echo "  /etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
echo "  /etc/letsencrypt/live/${DOMAIN}/privkey.pem"
