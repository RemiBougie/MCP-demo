"""
MCP Hello World Server
----------------------
A minimal MCP server with a single tool.
Transport: SSE (HTTP) — runs locally, ready for Azure deployment.

Connect via: http://localhost:8000/sse
"""

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("hello-world-server")


@mcp.tool()
def hello_world() -> str:
    """Returns a simple Hello World greeting."""
    return "Hello World!"


if __name__ == "__main__":
    # SSE transport binds to 0.0.0.0:8000 by default.
    # Use transport="stdio" if you need a local CLI-piped client instead.
    mcp.run(transport="sse")
