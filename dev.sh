#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Preflight checks ──────────────────────────────────────────────────────────
if [[ ! -f "$SCRIPT_DIR/.venv/bin/python" ]]; then
  echo "ERROR: .venv not found. Run: python -m venv .venv && .venv/bin/pip install -r server/requirements.txt"
  exit 1
fi

if [[ ! -f "$SCRIPT_DIR/.env" ]]; then
  echo "ERROR: .env not found. Copy .env.example and fill in your credentials."
  exit 1
fi

if [[ ! -f "$SCRIPT_DIR/client-ts/.env.local" ]]; then
  echo "ERROR: client-ts/.env.local not found. Add ANTHROPIC_API_KEY, MCP_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET, NEXTAUTH_URL."
  exit 1
fi

# ── Cleanup on exit ───────────────────────────────────────────────────────────
SERVER_PID=""
CLIENT_PID=""

cleanup() {
  echo ""
  echo "==> Shutting down..."
  [[ -n "$SERVER_PID" ]] && kill "$SERVER_PID" 2>/dev/null && echo "    MCP server stopped."
  [[ -n "$CLIENT_PID" ]] && kill "$CLIENT_PID" 2>/dev/null && echo "    Client stopped."
  exit 0
}

trap cleanup SIGINT SIGTERM

# ── Start MCP server ──────────────────────────────────────────────────────────
echo "==> Starting MCP server on http://localhost:8000 ..."
"$SCRIPT_DIR/.venv/bin/python" "$SCRIPT_DIR/server/server.py" 2>&1 | sed 's/^/[mcp]   /' &
SERVER_PID=$!

# Give the server a moment to bind before starting the client
sleep 2

# ── Start Next.js client ──────────────────────────────────────────────────────
echo "==> Starting Next.js client on http://localhost:3000 ..."
cd "$SCRIPT_DIR/client-ts" && npm run dev 2>&1 | sed 's/^/[client] /' &
CLIENT_PID=$!

echo ""
echo "  MCP server → http://localhost:8000"
echo "  Client     → http://localhost:3000"
echo ""
echo "  Press Ctrl+C to stop both."
echo ""

# ── Wait ─────────────────────────────────────────────────────────────────────
wait "$SERVER_PID" "$CLIENT_PID"
