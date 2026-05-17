#!/bin/sh
set -e

SESSION_EIP="${OPENSANDBOX_SESSION_EIP:-localhost}"
NETWORK="${OPENSANDBOX_DOCKER_NETWORK:-opensandbox-sandbox}"

pip install uv --quiet --root-user-action=ignore
uv pip install opensandbox-server --system --quiet

uv run opensandbox-server init-config /tmp/sandbox.toml --example docker --force

sed -i 's/host = "127.0.0.1"/host = "0.0.0.0"/' /tmp/sandbox.toml
sed -i "s/network_mode = \"bridge\"/network_mode = \"${NETWORK}\"/" /tmp/sandbox.toml
sed -i "/^\[server\]$/a eip = \"${SESSION_EIP}\"" /tmp/sandbox.toml

echo "OpenSandbox config (server + docker):"
grep -A2 '^\[server\]' /tmp/sandbox.toml || true
grep -A3 '^\[docker\]' /tmp/sandbox.toml || true

exec uv run opensandbox-server --config /tmp/sandbox.toml
