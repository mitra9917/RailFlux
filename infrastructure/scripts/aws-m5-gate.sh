#!/usr/bin/env bash
# M5 AWS acceptance — baseline then optimized deploy/smoke/teardown (M5 #55).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

usage() {
  cat <<'EOF'
Usage:
  aws-m5-gate.sh --baseline-manifest PATH --optimized-manifest PATH [--dry-run|--execute]

Default is --dry-run. --execute runs paid AWS: deploy → smokes → teardown for each profile,
then account-wide orphan audit.

Required for --execute (same as aws:deploy:session):
  SYNTHETIC_JWT_SECRET, ACM_CERTIFICATE_ARN, ORIGIN_HEADER_VALUE
  CONTAINER_IMAGE (baseline) or CONTAINER_IMAGE_EDGE/READ/BOOKING/WORKER (optimized)

Gate acceptance: sequential baseline + optimized sessions; teardown leaves no paid orphan.
EOF
}

BASELINE_MANIFEST=""
OPTIMIZED_MANIFEST=""
EXECUTE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --baseline-manifest)
      BASELINE_MANIFEST="$2"
      shift 2
      ;;
    --optimized-manifest)
      OPTIMIZED_MANIFEST="$2"
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

if [[ -z "${BASELINE_MANIFEST}" || -z "${OPTIMIZED_MANIFEST}" ]]; then
  usage >&2
  exit 1
fi

run_cmd() {
  echo "+ $*"
  if (( EXECUTE == 1 )); then
    "$@"
  fi
}

manifest_session() {
  local manifest="$1"
  # shellcheck disable=SC1090
  eval "$(node "${ROOT}/infrastructure/scripts/aws-run-manifest.mjs" "${manifest}" shell)"
  echo "${RAILFLUX_SESSION}"
}

run_profile_phase() {
  local manifest="$1"
  local label="$2"
  # shellcheck disable=SC1090
  eval "$(node "${ROOT}/infrastructure/scripts/aws-run-manifest.mjs" "${manifest}" shell)"
  local session="${RAILFLUX_SESSION}"
  local profile="${RAILFLUX_DEPLOYMENT_PROFILE}"

  echo ""
  echo "==> M5 AWS gate phase: ${label} (${profile}, session=${session})"
  if (( EXECUTE == 0 )); then
    echo "    (dry-run — pass --execute to run in AWS)"
  fi

  run_cmd "${ROOT}/infrastructure/scripts/aws-deploy-preflight.sh" --manifest "${manifest}"
  if (( EXECUTE == 1 )); then
    run_cmd npm run aws:deploy:session -- --manifest "${manifest}" --execute
  else
    run_cmd npm run aws:deploy:session -- --manifest "${manifest}"
  fi

  if (( EXECUTE == 1 )); then
    run_cmd npm run aws:smoke:rds-migrate -- --session "${session}"
    run_cmd npm run aws:smoke:ecs-alb -- --profile "${profile}" --session "${session}"
    if [[ "${profile}" == aws-optimized ]]; then
      run_cmd npm run aws:smoke:sqs-worker -- --session "${session}"
    fi
    run_cmd npm run aws:smoke:observability -- --session "${session}" --run-id "${RAILFLUX_RUN_ID}"
    run_cmd npm run aws:smoke:security -- --profile "${profile}" --session "${session}"
    run_cmd npm run aws:teardown:session -- --manifest "${manifest}" --execute --record-teardown
  else
    run_cmd npm run aws:teardown:session -- --manifest "${manifest}"
    run_cmd npm run aws:audit:orphans -- --session "${session}"
  fi
}

echo "==> M5 AWS gate (baseline then optimized)"
BASELINE_SESSION="$(manifest_session "${BASELINE_MANIFEST}")"
OPTIMIZED_SESSION="$(manifest_session "${OPTIMIZED_MANIFEST}")"
echo "    baseline session=${BASELINE_SESSION} manifest=${BASELINE_MANIFEST}"
echo "    optimized session=${OPTIMIZED_SESSION} manifest=${OPTIMIZED_MANIFEST}"

if (( EXECUTE == 1 )); then
  export RAILFLUX_REQUIRE_EXECUTE_ENV=1
  run_cmd npm run aws:smoke:account-budgets
fi

run_profile_phase "${BASELINE_MANIFEST}" "baseline"
run_profile_phase "${OPTIMIZED_MANIFEST}" "optimized"

if (( EXECUTE == 1 )); then
  echo ""
  echo "==> M5 AWS gate: final orphan audit (both regions)"
  run_cmd npm run aws:audit:orphans
else
  run_cmd npm run aws:audit:orphans
fi

echo ""
echo "M5 AWS gate plan finished."
