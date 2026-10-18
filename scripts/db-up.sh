#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="${RAILFLUX_COMPOSE_FILE:-${ROOT}/infrastructure/compose/docker-compose.yml}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for npm run db:up. Install Docker Desktop, then retry." >&2
  exit 1
fi

HOST_PORT="${RAILFLUX_MYSQL_HOST_PORT:-3307}"
if lsof -iTCP:"$HOST_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  if ! docker ps --format '{{.Names}}' | grep -qx railflux-mysql; then
    echo "Port ${HOST_PORT} is in use by another process (not railflux-mysql)." >&2
    echo "Change RAILFLUX_MYSQL_HOST_PORT or the ports mapping in infrastructure/compose/docker-compose.yml." >&2
    lsof -iTCP:"$HOST_PORT" -sTCP:LISTEN || true
    exit 1
  fi
fi

docker compose -f "$COMPOSE_FILE" up -d mysql
"${ROOT}/scripts/wait-for-mysql.sh"
