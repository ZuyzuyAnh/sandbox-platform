#!/usr/bin/env bash
# Install Docker Compose v2 and Buildx for Amazon Linux 2023 (not in default dnf repos).
set -euo pipefail

PLUGIN_DIR=/usr/local/lib/docker/cli-plugins
sudo mkdir -p "${PLUGIN_DIR}"

echo "Installing Docker Compose plugin..."
sudo curl -fsSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" \
  -o "${PLUGIN_DIR}/docker-compose"
sudo chmod +x "${PLUGIN_DIR}/docker-compose"

echo "Installing Docker Buildx plugin..."
ARCH=amd64
[ "$(uname -m)" = "aarch64" ] && ARCH=arm64
BUILDX_VERSION=v0.20.1
sudo curl -fsSL "https://github.com/docker/buildx/releases/download/${BUILDX_VERSION}/buildx-${BUILDX_VERSION}.linux-${ARCH}" \
  -o "${PLUGIN_DIR}/docker-buildx"
sudo chmod +x "${PLUGIN_DIR}/docker-buildx"

echo ""
docker compose version
docker buildx version

echo ""
echo "Initializing buildx builder..."
docker buildx create --name sandbox-builder --use 2>/dev/null || docker buildx use sandbox-builder 2>/dev/null || true
docker buildx inspect --bootstrap

echo ""
echo "Done. Run: docker compose -f docker-compose.prod.yaml --env-file .env.production up -d --build"
