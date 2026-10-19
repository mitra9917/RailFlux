#!/usr/bin/env bash
# M2 acceptance gate — local reproduction of CI + optional TC-001 against Compose MySQL.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> M2 gate: npm run ci"
npm run ci

echo "==> M2 gate: Compose baseline images build"
docker compose -f infrastructure/compose/docker-compose.yml \
  --project-directory infrastructure/compose \
  --profile baseline build

if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  echo "Skip TC-001 (Docker not available). Rely on CI job MySQL migrate and fixture load."
  exit 0
fi

if docker ps --format '{{.Names}}' | grep -qx railflux-mysql; then
  echo "==> M2 gate: TC-001 against Compose MySQL (host port ${MYSQL_PORT:-3307})"
  export MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
  export MYSQL_PORT="${MYSQL_PORT:-3307}"
  export MYSQL_USER="${MYSQL_USER:-railflux}"
  export MYSQL_PASSWORD="${MYSQL_PASSWORD:-railflux}"
  export MYSQL_DATABASE="${MYSQL_DATABASE:-railflux}"
  export TC001_INTEGRATION=1
  export SYNTHETIC_JWT_SECRET="${SYNTHETIC_JWT_SECRET:-tc001-test-secret}"
  npm run test:tc001
else
  echo "Skip TC-001 (railflux-mysql not running). Start with: npm run db:up && npm run db:load"
  echo "CI job MySQL migrate and fixture load is authoritative for TC-001 on PRs."
fi

echo "M2 gate checks complete."
