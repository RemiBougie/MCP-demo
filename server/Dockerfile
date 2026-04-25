# syntax=docker/dockerfile:1
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1
WORKDIR /app

COPY server/requirements.txt .
RUN pip install --no-cache-dir fastmcp pymssql python-dotenv uvicorn

COPY server/server.py .

ENV PORT=8000
EXPOSE 8000

CMD ["python", "server.py"]
