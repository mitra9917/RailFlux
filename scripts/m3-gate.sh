#!/usr/bin/env bash
# M3 acceptance gate — CI parity + booking correctness integration (TC-003–TC-009, outbox, correctness SQL).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> M3 gate: npm run ci"
npm run ci

echo "==> M3 gate: Compose baseline images build"
docker compose -f infrastructure/compose/docker-compose.yml \
  --project-directory infrastructure/compose \
  --profile baseline build

if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  echo "Skip M3 MySQL integration (Docker not available). Rely on CI database-smoke job."
  exit 0
fi

if ! docker ps --format '{{.Names}}' | grep -qx railflux-mysql; then
  echo "Skip M3 MySQL integration (railflux-mysql not running)."
  echo "Start with: npm run db:up && npm run db:load"
  echo "CI database-smoke job is authoritative for integration tests on PRs."
  exit 0
fi

echo "==> M3 gate: booking catalog TC-003–TC-009 + outbox + correctness runner"
export MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
export MYSQL_PORT="${MYSQL_PORT:-3307}"
export MYSQL_USER="${MYSQL_USER:-railflux}"
export MYSQL_PASSWORD="${MYSQL_PASSWORD:-railflux}"
export MYSQL_DATABASE="${MYSQL_DATABASE:-railflux}"

npm run test:m3-tc003-009
npm run test:booking-outbox
npm run test:correctness

GATE_RUN_ID="m3-gate-local-$(date +%Y%m%d%H%M%S)"
echo "==> M3 gate: post-run correctness SQL (run_id=${GATE_RUN_ID})"
node database/scripts/run-correctness.mjs --run-id "${GATE_RUN_ID}"

echo "M3 gate checks complete."
