#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common-env.sh
source "${SCRIPT_DIR}/common-env.sh"

fixture_id="$(grep '^fixture_id:' "$FIXTURE_MANIFEST" | head -1 | sed 's/fixture_id:[[:space:]]*//' | tr -d '"' | tr -d "'")"

if [[ -z "$fixture_id" ]]; then
  echo "could not read fixture_id from ${FIXTURE_MANIFEST}" >&2
  exit 1
fi

if ! command -v mysql >/dev/null 2>&1; then
  echo "mysql client not found" >&2
  exit 1
fi

echo "reset experiment state for fixture ${fixture_id} on ${MYSQL_DATABASE}"

mysql_exec <<SQL
SET @fixture_id := '${fixture_id}';
$(cat "${SCRIPT_DIR}/reset-experiment.sql")
SQL

echo "reset complete"
