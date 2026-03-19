# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# MCP Hello World Server — Dockerfile
# Builds a minimal, production-ready image for Azure Container Apps.
# ---------------------------------------------------------------------------

    FROM python:3.12-slim

    # Keeps Python from buffering stdout/stderr (important for MCP SSE streaming)
    ENV PYTHONUNBUFFERED=1
    
    WORKDIR /app
    
    # Install dependencies first (better layer caching)
    COPY requirements.txt .
    RUN pip install --no-cache-dir -r requirements.txt
    
    # Copy application code
    COPY server.py .
    
    # Container Apps will inject PORT at runtime; default to 8000 locally.
    ENV PORT=8000
    EXPOSE 8000
    
    CMD ["python", "server.py"]