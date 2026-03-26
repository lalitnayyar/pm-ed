#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
IMAGE_NAME="pm-mvp:dev"
CONTAINER_NAME="pm-mvp"

cd "${ROOT_DIR}"

docker build -t "${IMAGE_NAME}" .

if docker ps -a --format '{{.Names}}' | grep -Eq "^${CONTAINER_NAME}$"; then
  docker rm -f "${CONTAINER_NAME}" >/dev/null
fi

docker run -d --name "${CONTAINER_NAME}" -p 8000:8000 "${IMAGE_NAME}" >/dev/null

echo "Started ${CONTAINER_NAME} at http://127.0.0.1:8000"
