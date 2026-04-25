#!/usr/bin/env bash
set -euo pipefail

ACR="mcphelloworldacr2.azurecr.io"
IMAGE="$ACR/mcp-sql-analytics:latest"
APP="mcp-sql-analytics"
RG="mcp-rg"
SUFFIX=$(date +%Y%m%d%H%M%S)

echo "==> Logging in to ACR..."
az acr login --name mcphelloworldacr2

echo "==> Building image for linux/amd64..."
docker build --platform linux/amd64 -f server/Dockerfile -t "$IMAGE" .

echo "==> Pushing image..."
docker push "$IMAGE"

echo "==> Deploying new revision (suffix: $SUFFIX)..."
az containerapp update \
  --name "$APP" \
  --resource-group "$RG" \
  --image "$IMAGE" \
  --revision-suffix "$SUFFIX"

echo "==> Done. Revision: $APP--$SUFFIX"
