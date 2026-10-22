#!/usr/bin/env bash
# Mint JWT for a real fixture user (M6 #57 load tests).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPT_DIR="${ROOT}/database/scripts"
# shellcheck source=../../database/scripts/common-env.sh
source "${SCRIPT_DIR}/common-env.sh"

SECRET="${SYNTHETIC_JWT_SECRET:-dev-only-change-me}"
export SYNTHETIC_JWT_SECRET="${SECRET}"

USER_ID="$(mysql_exec -N -e 'SELECT id FROM users ORDER BY id LIMIT 1')"
if [[ -z "${USER_ID}" ]]; then
  echo "No users in ${MYSQL_DATABASE}. Run npm run db:bootstrap or npm run db:load first." >&2
  exit 1
fi

export K6_USER_ID="${USER_ID}"
export K6_BEARER_TOKEN="$(
  node "${ROOT}/scripts/mint-synthetic-jwt.mjs" "${USER_ID}" browser
)"
echo "==> k6 auth user_id=${K6_USER_ID}"
