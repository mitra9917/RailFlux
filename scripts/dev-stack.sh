#!/usr/bin/env bash
# One terminal: Docker MySQL (3307) + baseline dev server (3000).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Start Docker Desktop, then retry." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker engine is not running. Open Docker Desktop, then retry." >&2
  exit 1
fi

if [[ ! -f services/baseline/.env ]]; then
  echo "Creating services/baseline/.env from .env.example"
  cp services/baseline/.env.example services/baseline/.env
fi

echo "==> MySQL (Docker, host port 3307)"
npm run db:up

if lsof -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port 3000 is already in use. Stop the other process (often: npm run dev) or kill:" >&2
  lsof -iTCP:3000 -sTCP:LISTEN >&2 || true
  exit 1
fi

echo "==> Baseline API (http://127.0.0.1:3000)"
echo "    Health: curl http://127.0.0.1:3000/health/live"
echo "    Stop API: Ctrl+C (MySQL container keeps running; stop with: docker stop railflux-mysql)"
echo ""

npm run build:shared
exec npm run dev -w @railflux/baseline
