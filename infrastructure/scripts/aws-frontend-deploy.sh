#!/usr/bin/env bash
# Build Vite frontend and deploy to S3 + CloudFront (static demo or full cloudfront-* stack).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=cfn-lib.sh
source "$(dirname "$0")/cfn-lib.sh"

usage() {
  cat <<'EOF'
Usage:
  aws-frontend-deploy.sh --session NAME --expires-at ISO8601 [options]

Modes:
  --mode static     Deploy railflux-frontend-static-SESSION (S3+CF, UI only). Default.
  --mode publish    Upload to existing cloudfront-baseline|optimized stack (needs ALB+ECS).

Options:
  --session NAME       Required. Lowercase session id.
  --expires-at ISO8601 Required. Teardown deadline tag.
  --run-id ID          Default: session name.
  --owner NAME         Default: railflux.
  --profile TARGET     For publish: cloudfront-baseline | cloudfront-optimized (default baseline).
  --skip-build         Skip npm run build:frontend (use existing frontend/dist).
  --no-invalidate      Skip CloudFront invalidation.
  --no-preflight       Skip aws sts get-caller-identity.

Production build uses same-origin /v1 (empty VITE_API_BASE_URL). Optional:
  FRONTEND_BUILD_ENV_FILE=frontend/.env.production

Examples:
  # Phase 1 — demo website (hero + UI; API calls need backend later):
  ./infrastructure/scripts/aws-frontend-deploy.sh \\
    --session demo-mitra --expires-at 2026-12-31T23:59:59Z

  # Phase 2 — after aws:deploy:cloudfront-baseline:
  ./infrastructure/scripts/aws-frontend-deploy.sh \\
    --mode publish --session lab1 --expires-at 2026-12-31T23:59:59Z
EOF
}

MODE="static"
SESSION=""
EXPIRES_AT=""
RUN_ID=""
OWNER="railflux"
CF_PROFILE="cloudfront-baseline"
SKIP_BUILD=0
NO_INVALIDATE=0
NO_PREFLIGHT=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE="$2"
      shift 2
      ;;
    --session)
      SESSION="$2"
      shift 2
      ;;
    --expires-at)
      EXPIRES_AT="$2"
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
    --profile)
      CF_PROFILE="$2"
      shift 2
      ;;
    --skip-build)
      SKIP_BUILD=1
      shift
      ;;
    --no-invalidate)
      NO_INVALIDATE=1
      shift
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

case "${MODE}" in
  static | publish) ;;
  *)
    echo "--mode must be static or publish." >&2
    exit 1
    ;;
esac

if [[ -z "${SESSION}" || -z "${EXPIRES_AT}" ]]; then
  echo "--session and --expires-at are required." >&2
  usage >&2
  exit 1
fi

if [[ -z "${RUN_ID}" ]]; then
  RUN_ID="${SESSION}"
fi

if (( NO_PREFLIGHT == 0 )); then
  railflux_preflight_caller
else
  railflux_require_aws_cli
fi

REGION="$(railflux_region_for_profile aws-baseline)"

if [[ "${MODE}" == static ]]; then
  STACK="railflux-frontend-static-${SESSION}"
  TEMPLATE="${ROOT}/infrastructure/cloudformation/shared/cloudfront-static-site.yaml"
  echo "==> [1/4] CloudFormation stack ${STACK} (${REGION})"
  TAG_ARGS=()
  railflux_cfn_deploy_tags_argv TAG_ARGS "${RUN_ID}" "${OWNER}" "${EXPIRES_AT}" "frontend-static"

  railflux_cfn_deploy_with_progress "${STACK}" "${REGION}" \
    --template-file "${TEMPLATE}" \
    --stack-name "${STACK}" \
    --region "${REGION}" \
    --no-fail-on-empty-changeset \
    --parameter-overrides \
    "SessionName=${SESSION}" \
    "RunId=${RUN_ID}" \
    "Owner=${OWNER}" \
    "ExpiresAt=${EXPIRES_AT}" \
    "${TAG_ARGS[@]}"
else
  case "${CF_PROFILE}" in
    cloudfront-baseline | cloudfront-optimized) ;;
    *)
      echo "--profile must be cloudfront-baseline or cloudfront-optimized." >&2
      exit 1
      ;;
  esac
  STACK="$(railflux_module_stack_name "${CF_PROFILE}" "${SESSION}")"
  if ! aws cloudformation describe-stacks --stack-name "${STACK}" --region "${REGION}" >/dev/null 2>&1; then
    echo "Stack ${STACK} not found. Deploy ${CF_PROFILE} first (needs ALB+ECS)." >&2
    exit 1
  fi
fi

BUCKET="$(railflux_cfn_output "${STACK}" FrontendBucketName "${REGION}")"
DIST_ID="$(railflux_cfn_output "${STACK}" DistributionId "${REGION}")"
URL="$(railflux_cfn_output "${STACK}" DistributionUrl "${REGION}")"

if [[ -z "${BUCKET}" || "${BUCKET}" == None ]]; then
  echo "Could not read FrontendBucketName from ${STACK}." >&2
  exit 1
fi

if (( SKIP_BUILD == 0 )); then
  echo "==> [2/4] Building frontend (production, same-origin /v1)"
  BUILD_ENV=(env VITE_API_BASE_URL=)
  if [[ -n "${FRONTEND_BUILD_ENV_FILE:-}" && -f "${FRONTEND_BUILD_ENV_FILE}" ]]; then
    set -a
    # shellcheck source=/dev/null
    source "${FRONTEND_BUILD_ENV_FILE}"
    set +a
    BUILD_ENV=(env VITE_API_BASE_URL="${VITE_API_BASE_URL:-}" VITE_SYNTHETIC_JWT_SECRET="${VITE_SYNTHETIC_JWT_SECRET:-}" VITE_SYNTHETIC_USER_ID="${VITE_SYNTHETIC_USER_ID:-}")
  fi
  (cd "${ROOT}" && "${BUILD_ENV[@]}" npm run build:frontend)
fi

if [[ ! -f "${ROOT}/frontend/dist/index.html" ]]; then
  echo "Missing frontend/dist/index.html — run build first." >&2
  exit 1
fi

echo "==> [3/4] Sync s3://${BUCKET}/ (file progress below)"
aws s3 sync "${ROOT}/frontend/dist/" "s3://${BUCKET}/" --delete --region "${REGION}"

if (( NO_INVALIDATE == 0 )) && [[ -n "${DIST_ID}" && "${DIST_ID}" != None ]]; then
  echo "==> [4/4] CloudFront invalidation ${DIST_ID}"
  aws cloudfront create-invalidation \
    --distribution-id "${DIST_ID}" \
    --paths "/*" \
    --query 'Invalidation.Id' \
    --output text
fi

echo ""
echo "Deploy complete."
echo "  URL:    ${URL}"
echo "  Bucket: ${BUCKET}"
if [[ "${MODE}" == static ]]; then
  echo ""
  echo "Static demo: UI loads from CloudFront. Search/Book need backend + publish mode or full session deploy."
  echo "Compare page needs local dual-stack; skip for AWS demo until backend is wired."
fi
