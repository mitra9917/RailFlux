#!/usr/bin/env bash
# Optimized async path smoke — SQS queues + worker ECS service (M5 #49).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=cfn-lib.sh
source "$(dirname "$0")/cfn-lib.sh"

usage() {
  cat <<'EOF'
Usage:
  aws-sqs-worker-smoke.sh --session NAME

Checks side-effects queue/DLQ exist and worker service is running when deployed.
EOF
}

SESSION=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --session)
      SESSION="$2"
      shift 2
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

railflux_preflight_caller

SQS_STACK="$(railflux_module_stack_name sqs-worker "${SESSION}")"
ECS_STACK="$(railflux_module_stack_name ecs-optimized "${SESSION}")"
REGION="${RAILFLUX_APP_REGION}"

if ! aws cloudformation describe-stacks --stack-name "${SQS_STACK}" --region "${REGION}" >/dev/null 2>&1; then
  echo "SQS stack ${SQS_STACK} not found. Deploy sqs-worker first." >&2
  exit 1
fi

QUEUE_URL="$(railflux_cfn_output "${SQS_STACK}" SideEffectsQueueUrl)"
DLQ_URL="$(railflux_cfn_output "${SQS_STACK}" SideEffectsDlqUrl)"
if [[ -z "${QUEUE_URL}" || "${QUEUE_URL}" == None ]]; then
  echo "Missing SideEffectsQueueUrl on ${SQS_STACK}." >&2
  exit 1
fi

echo "==> Queue attributes (${QUEUE_URL})"
aws sqs get-queue-attributes \
  --queue-url "${QUEUE_URL}" \
  --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible RedrivePolicy \
  --region "${REGION}"

echo "==> DLQ attributes (${DLQ_URL})"
aws sqs get-queue-attributes \
  --queue-url "${DLQ_URL}" \
  --attribute-names ApproximateNumberOfMessages \
  --region "${REGION}"

if aws cloudformation describe-stacks --stack-name "${ECS_STACK}" --region "${REGION}" >/dev/null 2>&1; then
  CLUSTER="$(railflux_cfn_output "${ECS_STACK}" EcsClusterName)"
  SERVICE="railflux-${SESSION}-worker"
  echo "==> Worker ECS service ${SERVICE} on ${CLUSTER}"
  aws ecs describe-services \
    --cluster "${CLUSTER}" \
    --services "${SERVICE}" \
    --region "${REGION}" \
    --query 'services[0].{desired:desiredCount,running:runningCount,pending:pendingCount,status:status}' \
    --output table
else
  echo "==> Skip ECS worker check (stack ${ECS_STACK} not found)"
fi

echo "SQS/worker smoke checks complete for session=${SESSION}."
