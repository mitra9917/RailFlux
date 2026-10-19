#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common-env.sh
source "${SCRIPT_DIR}/common-env.sh"

REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
exec node "${SCRIPT_DIR}/run-correctness.mjs" "$@"
