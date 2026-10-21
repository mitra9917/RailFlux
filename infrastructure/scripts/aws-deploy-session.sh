#!/usr/bin/env bash
# Orchestrate module deploy order from docs/runbooks/deployment.md (M5 #52).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEPLOY_MODULE="${ROOT}/infrastructure/scripts/aws-deploy-module.sh"

usage() {
  cat <<'EOF'
Usage:
  aws-deploy-session.sh --manifest PATH/to/run-manifest.yaml [--dry-run|--execute]

Default is --dry-run (print planned npm/aws commands only).

Required manifest fields: run_id, deployment.session_name, cost.expires_at, architecture.

Required env for --execute:
  SYNTHETIC_JWT_SECRET, ACM_CERTIFICATE_ARN, ORIGIN_HEADER_VALUE
  CONTAINER_IMAGE (baseline) OR CONTAINER_IMAGE_EDGE/READ/BOOKING/WORKER (optimized)

Optional: RAILFLUX_OWNER overrides manifest deployment.owner
EOF
}

MANIFEST=""
EXECUTE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --manifest)
      MANIFEST="$2"
      shift 2
      ;;
    --dry-run)
      EXECUTE=0
      shift
      ;;
    --execute)
      EXECUTE=1
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

if [[ -z "${MANIFEST}" ]]; then
  usage >&2
  exit 1
fi

if [[ "${EXECUTE}" == 1 ]]; then
  export RAILFLUX_REQUIRE_EXECUTE_ENV=1
fi

# shellcheck disable=SC1090
eval "$(node "${ROOT}/infrastructure/scripts/aws-run-manifest.mjs" "${MANIFEST}" shell)"

COMMON=(
  --session "${RAILFLUX_SESSION}"
  --run-id "${RAILFLUX_RUN_ID}"
  --owner "${RAILFLUX_OWNER:-railflux}"
  --expires-at "${RAILFLUX_EXPIRES_AT}"
)

run_cmd() {
  echo "+ $*"
  if (( EXECUTE == 1 )); then
    "$@"
  fi
}

IMAGE_ARGS=()
if [[ "${RAILFLUX_DEPLOYMENT_PROFILE}" == aws-optimized ]]; then
  IMAGE_ARGS=(
    --container-image-edge "${CONTAINER_IMAGE_EDGE:-}"
    --container-image-read "${CONTAINER_IMAGE_READ:-}"
    --container-image-booking "${CONTAINER_IMAGE_BOOKING:-}"
    --container-image-worker "${CONTAINER_IMAGE_WORKER:-}"
  )
else
  IMAGE_ARGS=(--container-image "${CONTAINER_IMAGE:-}")
fi

ORIGIN_ARGS=(
  --acm-certificate-arn "${ACM_CERTIFICATE_ARN:-}"
  --origin-header-value "${ORIGIN_HEADER_VALUE:-}"
  --waf-mode "${RAILFLUX_WAF_MODE}"
)

echo "==> Deploy plan (${RAILFLUX_DEPLOYMENT_PROFILE}, session=${RAILFLUX_SESSION}, run_id=${RAILFLUX_RUN_ID})"
if (( EXECUTE == 0 )); then
  echo "    (dry-run — pass --execute to apply)"
fi

if (( EXECUTE == 1 )); then
  run_cmd "${ROOT}/infrastructure/scripts/aws-deploy-preflight.sh" --manifest "${MANIFEST}"
else
  run_cmd node "${ROOT}/infrastructure/scripts/aws-run-manifest.mjs" "${MANIFEST}" check
fi

run_cmd "${DEPLOY_MODULE}" network "${COMMON[@]}"
run_cmd "${DEPLOY_MODULE}" rds "${COMMON[@]}"
run_cmd "${DEPLOY_MODULE}" iam "${COMMON[@]}" --deployment-profile "${RAILFLUX_DEPLOYMENT_PROFILE}"
run_cmd npm run aws:smoke:rds-migrate -- --session "${RAILFLUX_SESSION}"

if [[ "${RAILFLUX_DEPLOYMENT_PROFILE}" == aws-optimized ]]; then
  run_cmd "${DEPLOY_MODULE}" sqs-worker "${COMMON[@]}"
  run_cmd "${DEPLOY_MODULE}" iam "${COMMON[@]}" --deployment-profile aws-optimized
  run_cmd "${DEPLOY_MODULE}" rds-replica "${COMMON[@]}"
  run_cmd "${DEPLOY_MODULE}" elasticache "${COMMON[@]}"
fi

if [[ "${RAILFLUX_WAF_MODE}" == on ]]; then
  run_cmd npm run aws:deploy:edge-waf -- "${COMMON[@]}"
fi

if [[ "${RAILFLUX_DEPLOYMENT_PROFILE}" == aws-baseline ]]; then
  run_cmd "${DEPLOY_MODULE}" alb-baseline "${COMMON[@]}" "${ORIGIN_ARGS[@]}"
  run_cmd "${DEPLOY_MODULE}" ecs-baseline "${COMMON[@]}" "${IMAGE_ARGS[@]}" --synthetic-jwt-secret "${SYNTHETIC_JWT_SECRET:-}"
  run_cmd "${DEPLOY_MODULE}" cloudfront-baseline "${COMMON[@]}" --origin-header-value "${ORIGIN_HEADER_VALUE:-}" --waf-mode "${RAILFLUX_WAF_MODE}"
else
  run_cmd "${DEPLOY_MODULE}" alb-optimized "${COMMON[@]}" "${ORIGIN_ARGS[@]}"
  run_cmd "${DEPLOY_MODULE}" ecs-optimized "${COMMON[@]}" "${IMAGE_ARGS[@]}" --synthetic-jwt-secret "${SYNTHETIC_JWT_SECRET:-}"
  run_cmd npm run aws:smoke:ecs-alb -- --profile aws-optimized --session "${RAILFLUX_SESSION}"
  run_cmd npm run aws:smoke:sqs-worker -- --session "${RAILFLUX_SESSION}"
  run_cmd "${DEPLOY_MODULE}" cloudfront-optimized "${COMMON[@]}" --origin-header-value "${ORIGIN_HEADER_VALUE:-}" --waf-mode "${RAILFLUX_WAF_MODE}"
fi

run_cmd "${DEPLOY_MODULE}" observability "${COMMON[@]}" --deployment-profile "${RAILFLUX_DEPLOYMENT_PROFILE}"
run_cmd npm run aws:smoke:observability -- --session "${RAILFLUX_SESSION}" --run-id "${RAILFLUX_RUN_ID}"

echo "Deploy session plan finished."
