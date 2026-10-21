#!/usr/bin/env bash
# Deploy shared CloudFormation modules (network, iam) for a session (M5 #42).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=cfn-lib.sh
source "$(dirname "$0")/cfn-lib.sh"

usage() {
  cat <<'EOF'
Usage:
  aws-deploy-module.sh <network|iam|rds|rds-replica> --session NAME [options]

Options:
  --session NAME          Required session id (stack suffix).
  --run-id ID             RunId tag (default: session name).
  --owner NAME            Owner tag (default: railflux).
  --expires-at ISO8601    Required teardown deadline tag.
  --deployment-profile    For iam module: aws-baseline | aws-optimized (required for iam).
  --side-effects-queue-arn  Optimized booking/worker queue ARN (optional until queue exists).
  --side-effects-dlq-arn    DLQ ARN for worker inspect policy (optional).
  --db-secret-arn         Secrets Manager ARN for MySQL (optional).
  --app-port N            ECS/ALB app port (network module, default 3000).
  --no-preflight          Skip sts get-caller-identity.

Examples:
  ./infrastructure/scripts/aws-deploy-module.sh network --session lab1 --expires-at 2026-12-31T23:59:59Z
  ./infrastructure/scripts/aws-deploy-module.sh iam --session lab1 --deployment-profile aws-optimized \\
    --expires-at 2026-12-31T23:59:59Z --side-effects-queue-arn arn:aws:sqs:ap-south-1:123:q
EOF
}

MODULE=""
SESSION=""
RUN_ID=""
OWNER="railflux"
EXPIRES_AT=""
DEPLOYMENT_PROFILE=""
SIDE_EFFECTS_QUEUE_ARN=""
SIDE_EFFECTS_DLQ_ARN=""
DB_SECRET_ARN=""
APP_PORT="3000"
NO_PREFLIGHT=0

if [[ $# -lt 1 ]]; then
  usage >&2
  exit 1
fi

MODULE="$1"
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
    --deployment-profile)
      DEPLOYMENT_PROFILE="$2"
      shift 2
      ;;
    --side-effects-queue-arn)
      SIDE_EFFECTS_QUEUE_ARN="$2"
      shift 2
      ;;
    --side-effects-dlq-arn)
      SIDE_EFFECTS_DLQ_ARN="$2"
      shift 2
      ;;
    --db-secret-arn)
      DB_SECRET_ARN="$2"
      shift 2
      ;;
    --app-port)
      APP_PORT="$2"
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

case "${MODULE}" in
  network | iam | rds | rds-replica) ;;
  *)
    echo "Module must be network, iam, rds, or rds-replica." >&2
    exit 1
    ;;
esac

if [[ -z "${SESSION}" || -z "${EXPIRES_AT}" ]]; then
  echo "--session and --expires-at are required." >&2
  exit 1
fi

if [[ -z "${RUN_ID}" ]]; then
  RUN_ID="${SESSION}"
fi

if [[ "${MODULE}" == iam && -z "${DEPLOYMENT_PROFILE}" ]]; then
  echo "--deployment-profile is required for iam module." >&2
  exit 1
fi

if (( NO_PREFLIGHT == 0 )); then
  railflux_preflight_caller
else
  railflux_require_aws_cli
fi

"${ROOT}/infrastructure/scripts/cfn-validate.sh"

STACK="$(railflux_module_stack_name "${MODULE}" "${SESSION}")"
REGION="${RAILFLUX_APP_REGION}"
TAG_PROFILE="aws-module-${MODULE}"

case "${MODULE}" in
  network)
    TEMPLATE="${RAILFLUX_CFN_DIR}/shared/network.yaml"
    PREFIX_LIST="$(railflux_cloudfront_origin_prefix_list_id "${REGION}")"
    PARAM_OVERRIDES=(
      "SessionName=${SESSION}"
      "AppPort=${APP_PORT}"
      "CloudFrontOriginPrefixListId=${PREFIX_LIST}"
    )
    ;;
  iam)
    TEMPLATE="${RAILFLUX_CFN_DIR}/shared/iam-task-roles.yaml"
    TAG_PROFILE="${DEPLOYMENT_PROFILE}"
    if [[ -z "${DB_SECRET_ARN}" ]]; then
      RDS_STACK="$(railflux_module_stack_name rds "${SESSION}")"
      if aws cloudformation describe-stacks --stack-name "${RDS_STACK}" --region "${REGION}" >/dev/null 2>&1; then
        DB_SECRET_ARN="$(railflux_cfn_output "${RDS_STACK}" DbMasterSecretArn)"
      fi
    fi
    PARAM_OVERRIDES=(
      "SessionName=${SESSION}"
      "DeploymentProfile=${DEPLOYMENT_PROFILE}"
      "SideEffectsQueueArn=${SIDE_EFFECTS_QUEUE_ARN}"
      "SideEffectsDlqArn=${SIDE_EFFECTS_DLQ_ARN}"
      "DbSecretArn=${DB_SECRET_ARN}"
    )
    ;;
  rds)
    TEMPLATE="${RAILFLUX_CFN_DIR}/shared/rds-primary.yaml"
    railflux_require_network_stack "${SESSION}"
    NETWORK_STACK="$(railflux_module_stack_name network "${SESSION}")"
    SUBNETS="$(railflux_cfn_output "${NETWORK_STACK}" PrivateDataSubnetIds)"
    RDS_SG="$(railflux_cfn_output "${NETWORK_STACK}" RdsSecurityGroupId)"
    if [[ -z "${SUBNETS}" || "${SUBNETS}" == None || -z "${RDS_SG}" || "${RDS_SG}" == None ]]; then
      echo "Network stack ${NETWORK_STACK} is missing PrivateDataSubnetIds or RdsSecurityGroupId outputs." >&2
      exit 1
    fi
    PARAM_OVERRIDES=(
      "SessionName=${SESSION}"
      "PrivateDataSubnetIds=${SUBNETS}"
      "RdsSecurityGroupId=${RDS_SG}"
    )
    if [[ -n "${DB_SECRET_ARN}" ]]; then
      echo "Note: --db-secret-arn is ignored for rds module (RDS manages master secret)." >&2
    fi
    ;;
  rds-replica)
    TEMPLATE="${RAILFLUX_CFN_DIR}/optimized/rds-replica.yaml"
    TAG_PROFILE="aws-optimized"
    railflux_require_network_stack "${SESSION}"
    railflux_require_rds_primary_stack "${SESSION}"
    NETWORK_STACK="$(railflux_module_stack_name network "${SESSION}")"
    RDS_STACK="$(railflux_module_stack_name rds "${SESSION}")"
    RDS_SG="$(railflux_cfn_output "${NETWORK_STACK}" RdsSecurityGroupId)"
    SOURCE_ID="$(railflux_cfn_output "${RDS_STACK}" DbInstanceIdentifier)"
    if [[ -z "${RDS_SG}" || "${RDS_SG}" == None || -z "${SOURCE_ID}" || "${SOURCE_ID}" == None ]]; then
      echo "Missing network RDS SG or primary DbInstanceIdentifier for replica deploy." >&2
      exit 1
    fi
    PARAM_OVERRIDES=(
      "SessionName=${SESSION}"
      "SourceDbInstanceIdentifier=${SOURCE_ID}"
      "RdsSecurityGroupId=${RDS_SG}"
    )
    ;;
esac

TAG_ARGS=()
while IFS= read -r tag; do
  TAG_ARGS+=(--tags "${tag}")
done < <(railflux_cfn_tags "${RUN_ID}" "${OWNER}" "${EXPIRES_AT}" "${TAG_PROFILE}")

echo "==> Deploy module=${MODULE} stack=${STACK} region=${REGION}"

CAPS=()
if [[ "${MODULE}" == iam ]]; then
  CAPS=(--capabilities CAPABILITY_NAMED_IAM)
fi

aws cloudformation deploy \
  --template-file "${TEMPLATE}" \
  --stack-name "${STACK}" \
  --region "${REGION}" \
  --no-fail-on-empty-changeset \
  --parameter-overrides "${PARAM_OVERRIDES[@]}" \
  "${TAG_ARGS[@]}" \
  "${CAPS[@]}"

echo "Deploy complete: ${STACK} (${REGION})"
