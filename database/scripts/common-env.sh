#!/usr/bin/env bash
# Shared MySQL connection defaults for database scripts.

MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-railflux}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-railflux}"
MYSQL_DATABASE="${MYSQL_DATABASE:-railflux}"
FIXTURE_MANIFEST="${FIXTURE_MANIFEST:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/experiment/fixtures/manifest.yaml}"

export MYSQL_HOST MYSQL_PORT MYSQL_USER MYSQL_PASSWORD MYSQL_DATABASE FIXTURE_MANIFEST

if [[ -n "$MYSQL_PASSWORD" ]]; then
  export MYSQL_PWD="$MYSQL_PASSWORD"
fi

MYSQL_CLI="${MYSQL_CLI:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/mysql-cli.sh}"

mysql_exec() {
  "$MYSQL_CLI" -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" --protocol=TCP -D "$MYSQL_DATABASE" "$@"
}
