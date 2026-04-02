#!/usr/bin/env bash
# Start the full-stack app (no Docker) using the .venv Python environment.
# Builds the Next.js frontend, then serves everything from FastAPI on port 8000.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
PID_FILE="${ROOT_DIR}/.server.pid"

# ── guard: already running? ──────────────────────────────────────────────────
if [ -f "${PID_FILE}" ]; then
  OLD_PID=$(cat "${PID_FILE}")
  if kill -0 "${OLD_PID}" 2>/dev/null; then
    echo "Server is already running (PID ${OLD_PID})."
    echo "Run  ./scripts/dev-stop.sh  to stop it first."
    exit 1
  else
    rm -f "${PID_FILE}"
  fi
fi

# ── build frontend ────────────────────────────────────────────────────────────
echo "▶  Building frontend..."
cd "${ROOT_DIR}/frontend"
npm run build --silent
rm -rf "${ROOT_DIR}/backend/static"
cp -r out "${ROOT_DIR}/backend/static"
echo "✓  Frontend built and copied to backend/static"

# ── start backend in background ───────────────────────────────────────────────
cd "${ROOT_DIR}/backend"
source .venv/bin/activate

echo "▶  Starting FastAPI server on http://127.0.0.1:8000 ..."
nohup python3 -m uvicorn app.main:app --port 8000 \
  > "${ROOT_DIR}/.server.log" 2>&1 &

SERVER_PID=$!
echo "${SERVER_PID}" > "${PID_FILE}"

# wait a moment and confirm it started
sleep 2
if kill -0 "${SERVER_PID}" 2>/dev/null; then
  echo "✓  Server started (PID ${SERVER_PID})"
  echo "   Open  http://127.0.0.1:8000  in your browser"
  echo "   Logs  tail -f ${ROOT_DIR}/.server.log"
  echo "   Stop  ./scripts/dev-stop.sh"
else
  echo "✗  Server failed to start. Check logs:"
  cat "${ROOT_DIR}/.server.log"
  rm -f "${PID_FILE}"
  exit 1
fi
