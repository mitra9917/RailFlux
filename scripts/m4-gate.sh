#!/usr/bin/env bash
# M4 acceptance gate — optimized profile integration + Compose build (issue #40).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> M4 gate: npm run ci"
npm run ci

echo "==> M4 gate: Compose optimized images build"
docker compose -f infrastructure/compose/docker-compose.yml \
  --project-directory infrastructure/compose \
  --profile optimized build

if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  echo "Skip M4 MySQL/Redis/ElasticMQ integration (Docker not available). Rely on CI database-smoke job."
  exit 0
fi

if ! docker ps --format '{{.Names}}' | grep -qx railflux-mysql; then
  echo "Skip M4 integration (railflux-mysql not running)."
  echo "Start optimized stack: npm run compose:optimized"
  echo "Or MySQL only: npm run db:up && npm run db:load"
  echo "CI database-smoke job is authoritative for integration tests on PRs."
  exit 0
fi

export MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
export MYSQL_PORT="${MYSQL_PORT:-3307}"
export MYSQL_USER="${MYSQL_USER:-railflux}"
export MYSQL_PASSWORD="${MYSQL_PASSWORD:-railflux}"
export MYSQL_DATABASE="${MYSQL_DATABASE:-railflux}"

echo "==> M4 gate: optimized profile integration bundle (parity, cache, queue, worker)"
npm run test:m4-gate

if docker ps --format '{{.Names}}' | grep -qx railflux-edge; then
  EDGE_PORT="${EDGE_HOST_PORT:-3000}"
  if curl -sf "http://127.0.0.1:${EDGE_PORT}/health/ready" >/dev/null; then
    echo "==> M4 gate: Compose optimized edge readiness ok (:${EDGE_PORT})"
  else
    echo "WARN: railflux-edge running but /health/ready failed on :${EDGE_PORT}" >&2
    exit 1
  fi
fi

echo "M4 gate checks complete."
