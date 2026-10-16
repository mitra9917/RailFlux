#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
# shellcheck source=common-env.sh
source "${SCRIPT_DIR}/common-env.sh"

if ! command -v mysql >/dev/null 2>&1; then
  echo "mysql client not found" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node not found (required to generate deterministic seed SQL)" >&2
  exit 1
fi

if [[ "${SKIP_FIXTURE_VERIFY:-}" != "1" ]]; then
  echo "verify fixture checksums: ${FIXTURE_MANIFEST}"
  node "${SCRIPT_DIR}/verify-fixture.mjs"
fi

"${ROOT}/database/scripts/migrate.sh"

echo "seed fixture from ${FIXTURE_MANIFEST}"

node "${SCRIPT_DIR}/generate-seed-sql.mjs" | mysql_exec

user_count="$(mysql_exec -N -e 'SELECT COUNT(*) FROM users;')"
inventory_count="$(mysql_exec -N -e 'SELECT COUNT(*) FROM seat_inventory;')"

echo "seed complete: users=${user_count}, inventory_rows=${inventory_count}"
