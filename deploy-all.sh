#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=====> Deploying MCP server..."
bash "$SCRIPT_DIR/deploy-server.sh"

echo ""
echo "=====> Deploying client..."
bash "$SCRIPT_DIR/deploy-client.sh"

echo ""
echo "=====> All deployments complete."
