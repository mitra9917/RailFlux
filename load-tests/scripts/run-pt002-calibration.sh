#!/usr/bin/env bash
# PT-002 stepped calibration pilot — baseline SLO capacity (M7 #63).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

usage() {
  cat <<'EOF'
Usage:
  run-pt002-calibration.sh [--run-id ID] [--base-url URL] [--freeze]
    [--start-rate N] [--step-rate N] [--max-rate N] [--step-duration 60s]
    [--dry-run] [--skip-reset]

Requires: k6, API on baseline profile, SYNTHETIC_JWT_SECRET, MySQL for optional reset.

Writes pilot record under experiment/calibration/pilots/<run_id>.json
and k6 summaries under load-tests/results/pt-002-<run_id>-r<RATE>-summary.json

With --freeze, updates experiment/hypotheses.yaml when a passing capacity is found.
EOF
}

RUN_ID=""
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
FREEZE=0
DRY_RUN=0
SKIP_RESET=0
START_RATE="${PT002_START_RATE:-5}"
STEP_RATE="${PT002_STEP_RATE:-5}"
MAX_RATE="${PT002_MAX_RATE:-40}"
STEP_DURATION="${PT002_STEP_DURATION:-60s}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --run-id)
      RUN_ID="$2"
      shift 2
      ;;
    --base-url)
      BASE_URL="$2"
      shift 2
      ;;
    --start-rate)
      START_RATE="$2"
      shift 2
      ;;
    --step-rate)
      STEP_RATE="$2"
      shift 2
      ;;
    --max-rate)
      MAX_RATE="$2"
      shift 2
      ;;
    --step-duration)
      STEP_DURATION="$2"
      shift 2
      ;;
    --freeze)
      FREEZE=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --skip-reset)
      SKIP_RESET=1
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

export BASELINE_HEALTH_URL="${BASE_URL}"
echo "==> PT-002 calibration preflight health ${BASE_URL}"
"${ROOT}/scripts/check-baseline-health.sh"

if [[ "${DRY_RUN}" -eq 0 ]]; then
  # shellcheck source=resolve-k6-auth.sh
  source "${ROOT}/load-tests/scripts/resolve-k6-auth.sh"
  export K6_BEARER_TOKEN K6_USER_ID
fi

if [[ "${SKIP_RESET}" -eq 0 && "${DRY_RUN}" -eq 0 ]]; then
  echo "==> PT-002 db reset before pilot"
  (cd "${ROOT}" && npm run db:reset)
fi

ARGS=(--base-url "${BASE_URL}" --start-rate "${START_RATE}" --step-rate "${STEP_RATE}" --max-rate "${MAX_RATE}" --step-duration "${STEP_DURATION}")
if [[ -n "${RUN_ID}" ]]; then
  ARGS+=(--run-id "${RUN_ID}")
fi
if [[ "${DRY_RUN}" -eq 1 ]]; then
  ARGS+=(--dry-run)
fi

export BASE_URL
export PT002_START_RATE="${START_RATE}"
export PT002_STEP_RATE="${STEP_RATE}"
export PT002_MAX_RATE="${MAX_RATE}"
export PT002_STEP_DURATION="${STEP_DURATION}"

if [[ -z "${RUN_ID}" ]]; then
  RUN_ID="pt002-$(date -u +%Y%m%dT%H%M%SZ)"
  ARGS+=(--run-id "${RUN_ID}")
fi

if [[ "${DRY_RUN}" -eq 1 ]]; then
  node "${ROOT}/experiment/calibration/run-pt002-pilot.mjs" "${ARGS[@]}"
  exit 0
fi

echo "==> PT-002 stepped pilot run_id=${RUN_ID} | step=${STEP_DURATION} max_rate=${MAX_RATE} RPS | expect several minutes"
set +e
node "${ROOT}/experiment/calibration/run-pt002-pilot.mjs" "${ARGS[@]}"
STATUS=$?
set -e
if [[ "${STATUS}" -ne 0 ]]; then
  exit "${STATUS}"
fi

PILOT_JSON="${ROOT}/experiment/calibration/pilots/${RUN_ID}.json"
if [[ -z "${PILOT_JSON}" || ! -f "${PILOT_JSON}" ]]; then
  echo "Could not locate pilot artifact from pilot output." >&2
  exit 1
fi

if [[ "${FREEZE}" -eq 1 ]]; then
  echo "==> Freezing calibrated rates into experiment/hypotheses.yaml"
  node "${ROOT}/experiment/calibration/freeze-hypotheses.mjs" --pilot "${PILOT_JSON}"
fi

echo "PT-002 calibration pilot complete: ${PILOT_JSON}"
