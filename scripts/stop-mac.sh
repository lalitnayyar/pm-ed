#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="pm-mvp"

if docker ps -a --format '{{.Names}}' | grep -Eq "^${CONTAINER_NAME}$"; then
  docker rm -f "${CONTAINER_NAME}" >/dev/null
  echo "Stopped ${CONTAINER_NAME}"
else
  echo "Container ${CONTAINER_NAME} is not running"
fi
