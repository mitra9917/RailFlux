#!/usr/bin/env bash
# Verify manifest checksums, then seed MySQL (experiment fixture loader).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
# shellcheck source=common-env.sh
source "${SCRIPT_DIR}/common-env.sh"

echo "verify fixture checksums: ${FIXTURE_MANIFEST}"
node "${SCRIPT_DIR}/verify-fixture.mjs"

echo "load fixture into ${MYSQL_DATABASE}"
SKIP_FIXTURE_VERIFY=1 "${SCRIPT_DIR}/seed.sh"
