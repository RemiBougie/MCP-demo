#!/usr/bin/env bash
set -euo pipefail

ACR="mcphelloworldacr2.azurecr.io"
IMAGE="$ACR/mcp-client-ts:latest"
APP="mcp-client-ts"
RG="mcp-rg"
SUFFIX=$(date +%Y%m%d%H%M%S)

echo "==> Logging in to ACR..."
az acr login --name mcphelloworldacr2

echo "==> Building image for linux/amd64..."
docker build --platform linux/amd64 -t "$IMAGE" client-ts/

echo "==> Pushing image..."
docker push "$IMAGE"

echo "==> Deploying new revision (suffix: $SUFFIX)..."
az containerapp update \
  --name "$APP" \
  --resource-group "$RG" \
  --image "$IMAGE" \
  --revision-suffix "$SUFFIX" \
  --set-env-vars "NEXTAUTH_URL=https://sql-analytics.fourelementstechconsulting.com" "GOOGLE_CLIENT_ID=160900176224-h11a056elunbo0js6aulp3p16c87spg5.apps.googleusercontent.com" "MCP_SERVER_URL=https://mcp-sql-analytics.internal.mangoflower-6dbfeafb.centralus.azurecontainerapps.io/mcp"

echo "==> Done. Revision: $APP--$SUFFIX"
