# MCP Hello World on Azure Container Apps

Quick guide to build and deploy this MCP server to Azure, then verify it is reachable.

## What this deploys

- A Python `FastMCP` server from `server/server.py`
- Containerized with `server/Dockerfile`
- Hosted on Azure Container Apps with external ingress on port `8000`

## Prerequisites

- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Logged in to Azure:

```bash
az login
```

## 1) Set variables

```bash
RG="mcp-rg"
LOCATION="centralus"
ACR_NAME="mcphelloworldacr2"          # must be globally unique
ENV_NAME="mcp-env"
APP_NAME="mcp-hello-world"
IMAGE_NAME="mcp-hello-world:latest"
```

## 2) Create resource group + registry

```bash
az group create --name "$RG" --location "$LOCATION"

az acr create \
  --resource-group "$RG" \
  --name "$ACR_NAME" \
  --sku Basic \
  --admin-enabled true
```

## 3) Build and push the image (linux/amd64)

From the `server` directory:

```bash
cd server

az acr login --name "$ACR_NAME"

docker build --platform linux/amd64 -t mcp-hello-world:latest .
docker tag mcp-hello-world:latest "$ACR_NAME.azurecr.io/$IMAGE_NAME"
docker push "$ACR_NAME.azurecr.io/$IMAGE_NAME"
```

> Important: use `--platform linux/amd64` to avoid Azure Container Apps image platform errors.

## 4) Create Container Apps environment

```bash
az containerapp env create \
  --name "$ENV_NAME" \
  --resource-group "$RG" \
  --location "$LOCATION"
```

## 5) Deploy the container app

```bash
az containerapp create \
  --name "$APP_NAME" \
  --resource-group "$RG" \
  --environment "$ENV_NAME" \
  --image "$ACR_NAME.azurecr.io/$IMAGE_NAME" \
  --registry-server "$ACR_NAME.azurecr.io" \
  --target-port 8000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 0.25 \
  --memory 0.5Gi
```

## 6) Get the URL

```bash
FQDN=$(az containerapp show \
  --name "$APP_NAME" \
  --resource-group "$RG" \
  --query properties.configuration.ingress.fqdn \
  --output tsv)

echo "https://$FQDN"
```

## 7) Verify MCP is responding

Check endpoint behavior:

```bash
curl -i "https://$FQDN/mcp"
```

Expected: a protocol-level error if headers are missing (this is still a good sign that MCP is live).

Test MCP initialize request:

```bash
SESSION_ID=$(curl -sS -D - -o /dev/null \
  -H "Accept: text/event-stream" \
  "https://$FQDN/mcp" \
  | awk 'BEGIN{IGNORECASE=1} /^mcp-session-id:/ {print $2}' | tr -d '\r')

curl -sS -X POST "https://$FQDN/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $SESSION_ID" \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl-test","version":"1.0"}}}'
```

Expected: JSON-RPC `initialize` response with server info (for example `hello-world-server`).

## Notes / gotchas

- If `az acr build` is blocked in your subscription, local Docker build + `docker push` works.
- Root path (`/`) may return `404` and still be healthy.
- In this deployment, MCP responds at `/mcp` (not `/sse`).
