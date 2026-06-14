#!/usr/bin/env bash
# Build the base custom VS Code image and the 4 role-specific images used by
# the sandbox_role -> image mapping (backend/routers/sessions.py ROLE_IMAGE).
#
# Run from anywhere:  bash docker/build-role-images.sh
set -euo pipefail
cd "$(dirname "$0")"

echo "==> Building base image: opensandbox/vscode-claude:latest"
docker build -t opensandbox/vscode-claude:latest vscode-claude

for role in ba dev tester devops; do
  echo "==> Building role image: opensandbox/vscode-claude-$role:latest"
  docker build -t "opensandbox/vscode-claude-$role:latest" "vscode-claude-$role"
done

echo "==> Done. Built images:"
docker images --format '{{.Repository}}:{{.Tag}}' | grep vscode-claude
