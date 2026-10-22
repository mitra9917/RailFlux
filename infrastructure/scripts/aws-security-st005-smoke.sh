#!/usr/bin/env bash
# ST-005 — IAM negative simulation for task roles (M5 #54).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=cfn-lib.sh
source "$(dirname "$0")/cfn-lib.sh"

usage() {
  cat <<'EOF'
Usage:
  aws-security-st005-smoke.sh --session NAME [--deployment-profile aws-optimized|aws-baseline] [--evidence PATH]

Optimized (default): requires sqs-worker + iam stacks with queue ARNs and role outputs.
Baseline: tests monolith role only (uses placeholder queue ARN for simulation).
EOF
}

SESSION=""
DEPLOYMENT_PROFILE="aws-optimized"
EVIDENCE=""
NO_PREFLIGHT=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --session)
      SESSION="$2"
      shift 2
      ;;
    --deployment-profile)
      DEPLOYMENT_PROFILE="$2"
      shift 2
      ;;
    --evidence)
      EVIDENCE="$2"
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
  usage >&2
  exit 1
fi

if (( NO_PREFLIGHT == 0 )); then
  railflux_preflight_caller
fi

IAM_STACK="$(railflux_module_stack_name iam "${SESSION}")"
REGION="${RAILFLUX_APP_REGION}"

if ! aws cloudformation describe-stacks --stack-name "${IAM_STACK}" --region "${REGION}" >/dev/null 2>&1; then
  echo "IAM stack ${IAM_STACK} not found." >&2
  exit 1
fi

QUEUE_ARN=""
DLQ_ARN=""
if [[ "${DEPLOYMENT_PROFILE}" == aws-optimized ]]; then
  SQS_STACK="$(railflux_module_stack_name sqs-worker "${SESSION}")"
  if ! aws cloudformation describe-stacks --stack-name "${SQS_STACK}" --region "${REGION}" >/dev/null 2>&1; then
    echo "SQS stack ${SQS_STACK} not found (required for optimized ST-005)." >&2
    exit 1
  fi
  QUEUE_ARN="$(railflux_cfn_output "${SQS_STACK}" SideEffectsQueueArn)"
  DLQ_ARN="$(railflux_cfn_output "${SQS_STACK}" SideEffectsDlqArn)"
else
  ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
  QUEUE_ARN="arn:aws:sqs:${REGION}:${ACCOUNT_ID}:railflux-${SESSION}-side-effects-placeholder"
fi

cfn_role() {
  local key="$1"
  local val
  val="$(railflux_cfn_output "${IAM_STACK}" "${key}" 2>/dev/null || true)"
  if [[ -n "${val}" && "${val}" != None ]]; then
    echo "${val}"
  fi
}

ROLES_JSON="$(node -e "
const roles = {};
const pairs = process.argv.slice(1);
for (let i = 0; i < pairs.length; i += 2) {
  const key = pairs[i];
  const val = pairs[i + 1];
  if (val) roles[key] = val;
}
console.log(JSON.stringify(roles));
" \
  BaselineMonolithTaskRoleArn "$(cfn_role BaselineMonolithTaskRoleArn)" \
  ReadTaskRoleArn "$(cfn_role ReadTaskRoleArn)" \
  EdgeTaskRoleArn "$(cfn_role EdgeTaskRoleArn)" \
  BookingTaskRoleArn "$(cfn_role BookingTaskRoleArn)" \
  WorkerTaskRoleArn "$(cfn_role WorkerTaskRoleArn)")"

echo "==> ST-005 session=${SESSION} profile=${DEPLOYMENT_PROFILE}"

JSON_OUT=""
if [[ -n "${EVIDENCE}" ]]; then
  mkdir -p "$(dirname "${EVIDENCE}")"
  JSON_OUT="${EVIDENCE}.tmp"
else
  JSON_OUT="$(mktemp)"
fi

set +e
node "${ROOT}/infrastructure/scripts/aws-security-st005.mjs" \
  --deployment-profile "${DEPLOYMENT_PROFILE}" \
  --session "${SESSION}" \
  --queue-arn "${QUEUE_ARN}" \
  --dlq-arn "${DLQ_ARN}" \
  --roles-json "${ROLES_JSON}" \
  --json > "${JSON_OUT}"
code=$?
set -e

if [[ -n "${EVIDENCE}" ]]; then
  mv "${JSON_OUT}" "${EVIDENCE}"
  echo "    evidence: ${EVIDENCE}"
else
  cat "${JSON_OUT}"
  rm -f "${JSON_OUT}"
fi

exit "${code}"
