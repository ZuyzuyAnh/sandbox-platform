#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="${VSCODE_CLAUDE_IMAGE:-opensandbox/vscode-claude:latest}"
BASE="sandbox-registry.cn-zhangjiakou.cr.aliyuncs.com/opensandbox/vscode:latest"

echo "Pulling base image ${BASE}..."
docker pull "${BASE}"

echo "Building ${IMAGE}..."
docker build -t "${IMAGE}" "${ROOT}/docker/vscode-claude/"

echo "Done. Verify with: docker run --rm ${IMAGE} claude --version"
