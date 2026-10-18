#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="${RAILFLUX_COMPOSE_FILE:-${ROOT}/infrastructure/compose/docker-compose.yml}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker not found" >&2
  exit 1
fi

echo "waiting for railflux-mysql (healthcheck)..."
for _ in $(seq 1 60); do
  status="$(docker inspect -f '{{.State.Health.Status}}' railflux-mysql 2>/dev/null || echo missing)"
  if [[ "$status" == "healthy" ]]; then
    echo "mysql ready"
    exit 0
  fi
  if [[ "$status" == "missing" ]]; then
    echo "container railflux-mysql not running; run: npm run db:up" >&2
    exit 1
  fi
  sleep 2
done

echo "timed out waiting for mysql health" >&2
exit 1
