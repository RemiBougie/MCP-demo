"""
MCP Hello World Server
----------------------
A minimal MCP server with a single tool.
Transport: SSE (HTTP) — runs locally, ready for Azure deployment.

Connect via: http://localhost:8000/sse
"""

import os
from fastmcp import FastMCP

mcp = FastMCP("hello-world-server")


@mcp.tool()
def hello_world() -> str:
    """Returns a simple Hello World greeting."""
    return "Hello World!"

@mcp.tool()
def echo(input: str) -> str:
    """Returns the input string."""
    return input


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    # Use SSE transport to match `client/demo.ipynb` which connects to `http://localhost:<port>/sse`.
    # The installed MCP SDK's `FastMCP.run()` does not accept `host=...`, so we only pass `port`.
    # For remote/container deployments, bind to all interfaces via env var.
    os.environ.setdefault("FASTMCP_HOST", "0.0.0.0")
    os.environ.setdefault("FASTMCP_PORT", str(port))
    mcp.run(transport="http", host="0.0.0.0", port=port)
