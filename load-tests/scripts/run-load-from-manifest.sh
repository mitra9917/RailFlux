#!/usr/bin/env bash
# PT-005 / PT-006 from run manifest (M6 #57).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RESULTS="${ROOT}/load-tests/results"

usage() {
  cat <<'EOF'
Usage:
  run-load-from-manifest.sh --manifest PATH [--scenario pt005|pt006|both] [--base-url URL]
    [--rate N] [--duration 180s] [--dry-run]

Reads experiment.load_level, duration_seconds, inventory_profile from manifest.
Default scenario: pt005; adds pt006 when inventory_profile is contention (or use --scenario both).
EOF
}

MANIFEST=""
SCENARIO=""
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
RATE_OVERRIDE=""
DURATION_OVERRIDE=""
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --manifest)
      MANIFEST="$2"
      shift 2
      ;;
    --scenario)
      SCENARIO="$2"
      shift 2
      ;;
    --base-url)
      BASE_URL="$2"
      shift 2
      ;;
    --rate)
      RATE_OVERRIDE="$2"
      shift 2
      ;;
    --duration)
      DURATION_OVERRIDE="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
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

# shellcheck disable=SC1090
eval "$(node "${ROOT}/load-tests/scripts/load-manifest.mjs" "${MANIFEST}" shell)"
LOAD_RATE="${RATE_OVERRIDE:-${LOAD_RATE}}"
LOAD_DURATION="${DURATION_OVERRIDE:-${LOAD_DURATION}}"
export LOAD_MANIFEST="${LOAD_MANIFEST}"
export LOAD_RATE LOAD_DURATION LOAD_INVENTORY_PROFILE
export LOAD_LEVEL="${LOAD_LEVEL:-L80}"

if [[ -z "${SCENARIO}" ]]; then
  if [[ "${LOAD_RUN_PT006}" == 1 ]]; then
    SCENARIO="both"
  else
    SCENARIO="pt005"
  fi
fi

run_k6() {
  local test_id="$1"
  local script="$2"
  # Experiment controller sets LOAD_K6_RUN_ID so PT-005/PT-006 share one DB telemetry namespace.
  local run_id="${LOAD_K6_RUN_ID:-${LOAD_RUN_ID}-${test_id}}"

  local summary="${RESULTS}/${test_id}-${LOAD_RUN_ID}-summary.json"
  local raw="${RESULTS}/${test_id}-${LOAD_RUN_ID}-raw.ndjson"
  local artifact="${RESULTS}/${test_id}-${LOAD_RUN_ID}-artifact.json"

  echo "+ k6 ${test_id} run_id=${run_id} rate=${LOAD_RATE}/s duration=${LOAD_DURATION}"
  if (( DRY_RUN == 1 )); then
    return 0
  fi

  k6 run \
    --env "BASE_URL=${BASE_URL}" \
    --env "RUN_ID=${run_id}" \
    --env "K6_BEARER_TOKEN=${K6_BEARER_TOKEN}" \
    --env "K6_USER_ID=${K6_USER_ID}" \
    --env "LOAD_RATE=${LOAD_RATE}" \
    --env "LOAD_DURATION=${LOAD_DURATION}" \
    --summary-export "${summary}" \
    --out "json=${raw}" \
    "${script}"

  BASE_URL="${BASE_URL}" \
    node "${ROOT}/load-tests/scripts/write-load-artifact.mjs" \
    "${test_id}" "${run_id}" "${summary}" "${raw}" "${artifact}"
  echo "    artifact: ${artifact}"

  if (( DRY_RUN == 0 )); then
    if ! node "${ROOT}/load-tests/scripts/generator-preflight.mjs" k6-summary "${summary}"; then
      echo "Generator preflight failed for ${test_id} (see JSON above)." >&2
      return 1
    fi
  fi
}

if ! command -v k6 >/dev/null 2>&1; then
  echo "k6 is required." >&2
  exit 1
fi

export BASELINE_HEALTH_URL="${BASE_URL}"
echo "==> Load preflight manifest=${MANIFEST} scenario=${SCENARIO}"
if (( DRY_RUN == 0 )); then
  "${ROOT}/scripts/check-baseline-health.sh"
  "${ROOT}/load-tests/scripts/run-generator-preflight.sh" --base-url "${BASE_URL}"
  # shellcheck source=resolve-k6-auth.sh
  source "${ROOT}/load-tests/scripts/resolve-k6-auth.sh"
fi

mkdir -p "${RESULTS}"

case "${SCENARIO}" in
  pt005)
    run_k6 "PT-005" "${ROOT}/load-tests/k6/pt-005-mixed-traffic.js"
    ;;
  pt006)
    run_k6 "PT-006" "${ROOT}/load-tests/k6/pt-006-contention.js"
    ;;
  both)
    run_k6 "PT-005" "${ROOT}/load-tests/k6/pt-005-mixed-traffic.js"
    run_k6 "PT-006" "${ROOT}/load-tests/k6/pt-006-contention.js"
    ;;
  *)
    echo "Unknown scenario: ${SCENARIO}" >&2
    exit 1
    ;;
esac

echo "Load from manifest finished."
