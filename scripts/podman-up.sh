#!/bin/bash
# Starts all services using podman-compose with the podman-specific compose file.
# Exposes podman's Docker-compatible TCP API so opensandbox can connect without socket mounting.
#
# HOW IT WORKS:
# podman system service runs inside the Linux VM on 0.0.0.0:2375.
# Containers reach the VM via the bridge gateway 10.88.0.1 (not host.containers.internal
# which points to the macOS host). DOCKER_HOST=tcp://10.88.0.1:2375 in docker-compose-podman.yaml
# tells opensandbox's Docker SDK to use podman's Docker-compatible REST API over TCP.
#
# Usage: ./scripts/podman-up.sh [extra podman compose args]
# Example: ./scripts/podman-up.sh -d

set -e

COMPOSE_FILE="$(dirname "$0")/../docker-compose-podman.yaml"
PODMAN_TCP_PORT=2375

# Ensure podman machine is running
if ! podman info &>/dev/null; then
  echo "ERROR: Podman machine is not running. Run: podman machine start"
  exit 1
fi

# Start podman TCP API service inside the VM if not already listening
if ! podman machine ssh "curl -sf http://localhost:$PODMAN_TCP_PORT/version" &>/dev/null; then
  echo "Starting podman TCP API service on port $PODMAN_TCP_PORT inside VM..."
  podman machine ssh "nohup podman system service --time=0 tcp://0.0.0.0:$PODMAN_TCP_PORT &>/tmp/podman-svc.log &"
  sleep 1
  if ! podman machine ssh "curl -sf http://localhost:$PODMAN_TCP_PORT/version" &>/dev/null; then
    echo "ERROR: podman system service failed to start"
    exit 1
  fi
  echo "Podman TCP API service running on port $PODMAN_TCP_PORT"
else
  echo "Podman TCP API service already running on port $PODMAN_TCP_PORT"
fi

echo "Starting services..."
podman compose -f "$COMPOSE_FILE" up "$@"
