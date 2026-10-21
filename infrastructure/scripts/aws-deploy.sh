#!/usr/bin/env bash
# Deploy RailFlux aws-baseline, aws-optimized, or aws-edge-waf root stacks (M5 #41).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=cfn-lib.sh
source "$(dirname "$0")/cfn-lib.sh"

usage() {
  cat <<'EOF'
Usage:
  aws-deploy.sh <aws-baseline|aws-optimized|aws-edge-waf> [options]

Options:
  --session NAME       Required. Lowercase session id (stack suffix).
  --run-id ID          RunId tag (default: session name).
  --owner NAME         Owner tag (default: railflux).
  --expires-at ISO8601 Teardown deadline tag (required for paid sessions).
  --parameters FILE    JSON parameter overrides (merged with session flags).
  --no-preflight       Skip sts get-caller-identity check.

Examples:
  ./infrastructure/scripts/aws-deploy.sh aws-baseline \\
    --session lab1 --run-id run-001 --owner mitra9917 --expires-at 2026-10-22T00:00:00Z
  npm run aws:deploy:optimized -- --session lab1 --expires-at 2026-10-22T00:00:00Z
EOF
}

PROFILE=""
SESSION=""
RUN_ID=""
OWNER="railflux"
EXPIRES_AT=""
PARAM_FILE=""
NO_PREFLIGHT=0

if [[ $# -lt 1 ]]; then
  usage >&2
  exit 1
fi

PROFILE="$1"
shift

while [[ $# -gt 0 ]]; do
  case "$1" in
    --session)
      SESSION="$2"
      shift 2
      ;;
    --run-id)
      RUN_ID="$2"
      shift 2
      ;;
    --owner)
      OWNER="$2"
      shift 2
      ;;
    --expires-at)
      EXPIRES_AT="$2"
      shift 2
      ;;
    --parameters)
      PARAM_FILE="$2"
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

case "${PROFILE}" in
  aws-baseline | aws-optimized | aws-edge-waf) ;;
  *)
    echo "Profile must be aws-baseline, aws-optimized, or aws-edge-waf." >&2
    exit 1
    ;;
esac

if [[ -z "${SESSION}" ]]; then
  echo "--session is required." >&2
  exit 1
fi

if [[ -z "${RUN_ID}" ]]; then
  RUN_ID="${SESSION}"
fi

if [[ -z "${EXPIRES_AT}" ]]; then
  echo "--expires-at is required (ISO8601 teardown deadline tag)." >&2
  exit 1
fi

if (( NO_PREFLIGHT == 0 )); then
  railflux_preflight_caller
else
  railflux_require_aws_cli
fi

"${ROOT}/infrastructure/scripts/cfn-validate.sh"

TEMPLATE="$(railflux_template_for_profile "${PROFILE}")"
REGION="$(railflux_region_for_profile "${PROFILE}")"
STACK="$(railflux_stack_name "${PROFILE}" "${SESSION}")"

PARAM_OVERRIDES=(
  "SessionName=${SESSION}"
  "RunId=${RUN_ID}"
  "Owner=${OWNER}"
  "ExpiresAt=${EXPIRES_AT}"
)

if [[ "${PROFILE}" == aws-baseline ]]; then
  PARAM_OVERRIDES+=("DeploymentProfile=aws-baseline" "ApplicationRegion=${RAILFLUX_APP_REGION}")
elif [[ "${PROFILE}" == aws-optimized ]]; then
  PARAM_OVERRIDES+=("DeploymentProfile=aws-optimized" "ApplicationRegion=${RAILFLUX_APP_REGION}")
fi

if [[ -n "${PARAM_FILE}" ]]; then
  if [[ ! -f "${PARAM_FILE}" ]]; then
    echo "Parameter file not found: ${PARAM_FILE}" >&2
    exit 1
  fi
  if command -v jq >/dev/null 2>&1; then
    while IFS= read -r kv; do
      PARAM_OVERRIDES+=("${kv}")
    done < <(jq -r '.[] | "\(.ParameterKey)=\(.ParameterValue)"' "${PARAM_FILE}")
  else
    echo "jq is required to parse --parameters JSON files." >&2
    exit 1
  fi
fi

TAG_ARGS=()
while IFS= read -r tag; do
  TAG_ARGS+=(--tags "${tag}")
done < <(railflux_cfn_tags "${RUN_ID}" "${OWNER}" "${EXPIRES_AT}" "${PROFILE}")

echo "==> Deploy profile=${PROFILE} stack=${STACK} region=${REGION}"
echo "    template=${TEMPLATE#"${ROOT}/"}"

aws cloudformation deploy \
  --template-file "${TEMPLATE}" \
  --stack-name "${STACK}" \
  --region "${REGION}" \
  --no-fail-on-empty-changeset \
  --parameter-overrides "${PARAM_OVERRIDES[@]}" \
  "${TAG_ARGS[@]}"

echo "Deploy complete: ${STACK} (${REGION})"
