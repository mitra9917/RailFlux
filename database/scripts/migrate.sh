#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MIGRATIONS_DIR="${ROOT}/database/migrations"

MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-railflux}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-railflux}"
MYSQL_DATABASE="${MYSQL_DATABASE:-railflux}"

MYSQL_CLI="${MYSQL_CLI:-$(cd "$(dirname "$0")" && pwd)/mysql-cli.sh}"
MYSQL_CMD=("$MYSQL_CLI" -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" --protocol=TCP)
if [[ -n "$MYSQL_PASSWORD" ]]; then
  export MYSQL_PWD="$MYSQL_PASSWORD"
fi

ensure_database() {
  "$MYSQL_CLI" -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" --protocol=TCP \
    -e "CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
}

is_applied() {
  local version="$1"
  local count
  count="$("${MYSQL_CMD[@]}" -N -D "$MYSQL_DATABASE" -e \
    "SELECT COUNT(*) FROM schema_migrations WHERE version = '${version}';" 2>/dev/null || echo 0)"
  [[ "$count" != "0" ]]
}

apply_migration() {
  local file="$1"
  local version
  version="$(basename "$file" .sql)"

  if is_applied "$version"; then
    echo "skip: ${version} (already applied)"
    return 0
  fi

  echo "apply: ${version}"
  "${MYSQL_CMD[@]}" -D "$MYSQL_DATABASE" < "$file"
  "${MYSQL_CMD[@]}" -D "$MYSQL_DATABASE" -e \
    "INSERT INTO schema_migrations (version) VALUES ('${version}');"
}

main() {
  if ! command -v mysql >/dev/null 2>&1; then
    if ! command -v docker >/dev/null 2>&1; then
      echo "mysql client not found; install MySQL client or Docker (npm run db:up)." >&2
      exit 1
    fi
    if ! docker compose -f "${ROOT}/infrastructure/compose/docker-compose.yml" ps --status running mysql 2>/dev/null | grep -q mysql; then
      echo "mysql client not found; start Compose MySQL first: npm run db:up" >&2
      exit 1
    fi
  fi

  ensure_database

  shopt -s nullglob
  files=("${MIGRATIONS_DIR}"/*.sql)
  if [[ ${#files[@]} -eq 0 ]]; then
    echo "no migrations in ${MIGRATIONS_DIR}" >&2
    exit 1
  fi

  for file in "${files[@]}"; do
    apply_migration "$file"
  done

  echo "migrations complete for database ${MYSQL_DATABASE}"
}

main "$@"
