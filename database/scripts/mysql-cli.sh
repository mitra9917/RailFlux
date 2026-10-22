#!/usr/bin/env bash
# Run mysql client on the host, or via the Compose mysql service when the CLI is not installed.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${RAILFLUX_COMPOSE_FILE:-${ROOT}/infrastructure/compose/docker-compose.yml}"

if command -v mysql >/dev/null 2>&1; then
  exec mysql "$@"
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "mysql client not found and docker is unavailable." >&2
  echo "Install MySQL client (brew install mysql-client) or Docker, then run:" >&2
  echo "  npm run db:up" >&2
  exit 1
fi

if ! docker compose -f "$COMPOSE_FILE" ps --status running mysql 2>/dev/null | grep -q mysql; then
  echo "mysql client not found; start Compose MySQL first: npm run db:up" >&2
  exit 1
fi

# Callers pass host-published host/port (e.g. 3307); inside the container MySQL listens on 3306.
args=()
skip=0
for arg in "$@"; do
  if (( skip > 0 )); then
    skip=0
    continue
  fi
  case "$arg" in
    -h | --host | -P | --port) skip=1 ;;
    *) args+=("$arg") ;;
  esac
done

pwd="${MYSQL_PWD:-${MYSQL_PASSWORD:-}}"
if [[ -n "$pwd" ]]; then
  exec docker compose -f "$COMPOSE_FILE" exec -T -e "MYSQL_PWD=${pwd}" \
    mysql mysql --default-character-set=utf8mb4 --protocol=TCP -h127.0.0.1 -P3306 "${args[@]}"
fi
exec docker compose -f "$COMPOSE_FILE" exec -T mysql mysql --default-character-set=utf8mb4 --protocol=TCP -h127.0.0.1 -P3306 "${args[@]}"
