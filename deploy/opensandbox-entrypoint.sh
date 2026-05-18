#!/bin/sh
set -e

SESSION_EIP="${OPENSANDBOX_SESSION_EIP:-localhost}"
# Egress (networkPolicy) requires Docker bridge mode — not a user-defined network.
NETWORK="${OPENSANDBOX_DOCKER_NETWORK:-bridge}"
EGRESS_IMAGE="${OPENSANDBOX_EGRESS_IMAGE:-sandbox-registry.cn-zhangjiakou.cr.aliyuncs.com/opensandbox/egress:latest}"
EGRESS_MODE="${OPENSANDBOX_EGRESS_MODE:-dns+nft}"
EGRESS_ENABLED="${OPENSANDBOX_EGRESS_ENABLED:-0}"

pip install uv --quiet --root-user-action=ignore
uv pip install opensandbox-server --system --quiet

uv run opensandbox-server init-config /tmp/sandbox.toml --example docker --force

sed -i 's/host = "127.0.0.1"/host = "0.0.0.0"/' /tmp/sandbox.toml
sed -i "s/network_mode = \"bridge\"/network_mode = \"${NETWORK}\"/" /tmp/sandbox.toml
sed -i "/^\[server\]$/a eip = \"${SESSION_EIP}\"" /tmp/sandbox.toml

if [ "${EGRESS_ENABLED}" = "1" ]; then
  if [ "${NETWORK}" != "bridge" ]; then
    echo "ERROR: OPENSANDBOX_EGRESS_ENABLED=1 requires OPENSANDBOX_DOCKER_NETWORK=bridge" >&2
    exit 1
  fi
  cat >> /tmp/sandbox.toml <<EOF

[egress]
image = "${EGRESS_IMAGE}"
mode = "${EGRESS_MODE}"
EOF
  echo "Egress enabled: image=${EGRESS_IMAGE} mode=${EGRESS_MODE}"
fi

echo "OpenSandbox config (server + docker):"
grep -A2 '^\[server\]' /tmp/sandbox.toml || true
grep -A3 '^\[docker\]' /tmp/sandbox.toml || true
grep -A3 '^\[egress\]' /tmp/sandbox.toml || true

exec uv run opensandbox-server --config /tmp/sandbox.toml
