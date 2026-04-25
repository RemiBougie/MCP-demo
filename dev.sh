#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTAINER_NAME="mcp-sql-analytics-local"
CLIENT_PID=""

# ── Preflight checks ──────────────────────────────────────────────────────────
if [[ ! -f "$SCRIPT_DIR/.env" ]]; then
  echo "ERROR: .env not found. Copy .env.example and fill in your credentials."
  exit 1
fi

if [[ ! -f "$SCRIPT_DIR/client-ts/.env.local" ]]; then
  echo "ERROR: client-ts/.env.local not found. Add ANTHROPIC_API_KEY, MCP_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET, NEXTAUTH_URL."
  exit 1
fi

# ── Cleanup on exit ───────────────────────────────────────────────────────────
cleanup() {
  echo ""
  echo "==> Shutting down..."
  docker stop "$CONTAINER_NAME" 2>/dev/null && echo "    MCP server container stopped."
  [[ -n "$CLIENT_PID" ]] && kill "$CLIENT_PID" 2>/dev/null && echo "    Client stopped."
  exit 0
}

trap cleanup SIGINT SIGTERM

# ── Build and start MCP server container ─────────────────────────────────────
echo "==> Building MCP server image..."
docker build -f "$SCRIPT_DIR/server/Dockerfile" -t "$CONTAINER_NAME" "$SCRIPT_DIR" 2>&1 | sed 's/^/[mcp]   /'

echo "==> Starting MCP server container on http://localhost:8000 ..."
docker run --rm -d \
  --name "$CONTAINER_NAME" \
  --env-file "$SCRIPT_DIR/.env" \
  -p 8000:8000 \
  "$CONTAINER_NAME" > /dev/null

# Stream container logs in the background
docker logs -f "$CONTAINER_NAME" 2>&1 | sed 's/^/[mcp]   /' &

# Give the server a moment to bind before starting the client
sleep 2

# ── Start Next.js client ──────────────────────────────────────────────────────
echo "==> Starting Next.js client on http://localhost:3000 ..."
cd "$SCRIPT_DIR/client-ts" && npm run dev 2>&1 | sed 's/^/[client] /' &
CLIENT_PID=$!

echo ""
echo "  MCP server → http://localhost:8000  (Docker)"
echo "  Client     → http://localhost:3000  (npm run dev)"
echo ""
echo "  Press Ctrl+C to stop both."
echo ""

# ── Wait ──────────────────────────────────────────────────────────────────────
wait "$CLIENT_PID"
