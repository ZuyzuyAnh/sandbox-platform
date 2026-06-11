#!/usr/bin/env bash
# Podman equivalent of build-vscode-claude.sh.
# Builds the vscode-claude image using podman and pushes it into the podman VM
# so opensandbox can pull it by name when spawning sessions.
#
# Usage: ./scripts/build-vscode-podman.sh
# Override image name: VSCODE_CLAUDE_IMAGE=my-tag ./scripts/build-vscode-podman.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="${VSCODE_CLAUDE_IMAGE:-opensandbox/vscode-claude:latest}"
BASE="sandbox-registry.cn-zhangjiakou.cr.aliyuncs.com/opensandbox/vscode:latest"

# Ensure podman machine is running
if ! podman info &>/dev/null; then
  echo "ERROR: Podman machine is not running. Run: podman machine start"
  exit 1
fi

echo "Pulling base image ${BASE}..."
podman pull "${BASE}"

echo "Building ${IMAGE}..."
podman build -t "${IMAGE}" "${ROOT}/docker/vscode-claude/"

echo ""
echo "Done. To use this image, set in backend/.env:"
echo "  VSCODE_IMAGE=${IMAGE}"
echo ""
echo "Verify with: podman run --rm ${IMAGE} claude --version"
