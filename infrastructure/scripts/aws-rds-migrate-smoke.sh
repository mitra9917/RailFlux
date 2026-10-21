#!/usr/bin/env bash
# Connect to session RDS and run RailFlux migrations (M5 #43 baseline smoke).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=cfn-lib.sh
source "$(dirname "$0")/cfn-lib.sh"

usage() {
  cat <<'EOF'
Usage:
  aws-rds-migrate-smoke.sh --session NAME [--no-preflight]

Requires: network + rds CloudFormation stacks, mysql client, jq, AWS CLI.
Runs database/scripts/migrate.sh against the primary endpoint using the
RDS-managed master secret from stack outputs.
EOF
}

SESSION=""
NO_PREFLIGHT=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --session)
      SESSION="$2"
      shift 2
      ;;
    --no-preflight)
      NO_PREFLIGHT=1
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "${SESSION}" ]]; then
  echo "--session is required." >&2
  exit 1
fi

if (( NO_PREFLIGHT == 0 )); then
  railflux_preflight_caller
else
  railflux_require_aws_cli
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required to parse Secrets Manager JSON." >&2
  exit 1
fi

RDS_STACK="$(railflux_module_stack_name rds "${SESSION}")"
HOST="$(railflux_cfn_output "${RDS_STACK}" DbEndpointAddress)"
PORT="$(railflux_cfn_output "${RDS_STACK}" DbEndpointPort)"
DB_NAME="$(railflux_cfn_output "${RDS_STACK}" DbName)"
SECRET_ARN="$(railflux_cfn_output "${RDS_STACK}" DbMasterSecretArn)"

if [[ -z "${HOST}" || "${HOST}" == None || -z "${SECRET_ARN}" || "${SECRET_ARN}" == None ]]; then
  echo "RDS stack ${RDS_STACK} missing outputs. Deploy network + rds modules first." >&2
  exit 1
fi

SECRET_JSON="$(aws secretsmanager get-secret-value \
  --secret-id "${SECRET_ARN}" \
  --region "${RAILFLUX_APP_REGION}" \
  --query SecretString \
  --output text)"

MYSQL_USER="$(echo "${SECRET_JSON}" | jq -r .username)"
MYSQL_PASSWORD="$(echo "${SECRET_JSON}" | jq -r .password)"

if [[ -z "${MYSQL_USER}" || "${MYSQL_USER}" == null ]]; then
  echo "Could not read username from secret ${SECRET_ARN}" >&2
  exit 1
fi

echo "==> RDS migrate smoke session=${SESSION} host=${HOST} db=${DB_NAME}"

MYSQL_HOST="${HOST}" \
  MYSQL_PORT="${PORT:-3306}" \
  MYSQL_USER="${MYSQL_USER}" \
  MYSQL_PASSWORD="${MYSQL_PASSWORD}" \
  MYSQL_DATABASE="${DB_NAME}" \
  "${ROOT}/database/scripts/migrate.sh"

echo "RDS migrate smoke complete."
