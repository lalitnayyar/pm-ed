#!/usr/bin/env bash
# Stop the server started by dev-start.sh
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
PID_FILE="${ROOT_DIR}/.server.pid"

if [ ! -f "${PID_FILE}" ]; then
  echo "No PID file found — server may not be running."
  exit 0
fi

PID=$(cat "${PID_FILE}")

if kill -0 "${PID}" 2>/dev/null; then
  kill "${PID}"
  rm -f "${PID_FILE}"
  echo "✓  Server stopped (PID ${PID})"
else
  echo "Process ${PID} was not running — cleaning up."
  rm -f "${PID_FILE}"
fi
