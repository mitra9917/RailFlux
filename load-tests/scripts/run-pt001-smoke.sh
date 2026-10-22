#!/usr/bin/env bash
# PT-001 k6 smoke — health + search at 1–5 RPS (M6 #56).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RESULTS="${ROOT}/load-tests/results"
K6_SCRIPT="${ROOT}/load-tests/k6/pt-001-smoke.js"

usage() {
  cat <<'EOF'
Usage:
  run-pt001-smoke.sh [--run-id ID] [--base-url URL] [--rate 1-5] [--duration 30s]

Requires: k6 on PATH, API up (npm run compose:baseline or compose:optimized),
  SYNTHETIC_JWT_SECRET (default dev-only-change-me for local Compose).

Exports:
  load-tests/results/pt-001-<run_id>-summary.json
  load-tests/results/pt-001-<run_id>-raw.ndjson
  load-tests/results/pt-001-<run_id>-artifact.json
EOF
}

RUN_ID=""
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
RATE="${PT001_RATE:-3}"
DURATION="${PT001_DURATION:-30s}"

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
    --rate)
      RATE="$2"
      shift 2
      ;;
    --duration)
      DURATION="$2"
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

if ! command -v k6 >/dev/null 2>&1; then
  echo "k6 is required. Install: https://grafana.com/docs/k6/latest/set-up/install-k6/" >&2
  exit 1
fi

if [[ -z "${RUN_ID}" ]]; then
  RUN_ID="pt001-$(date -u +%Y%m%dT%H%M%SZ)"
fi

if ! [[ "${RATE}" =~ ^[1-5]$ ]]; then
  echo "PT-001 rate must be 1–5 RPS (got ${RATE})." >&2
  exit 1
fi

export BASELINE_HEALTH_URL="${BASE_URL}"
echo "==> PT-001 preflight health ${BASE_URL}"
"${ROOT}/scripts/check-baseline-health.sh"

SECRET="${SYNTHETIC_JWT_SECRET:-dev-only-change-me}"
export SYNTHETIC_JWT_SECRET="${SECRET}"
K6_BEARER_TOKEN="$(node "${ROOT}/scripts/mint-synthetic-jwt.mjs" 11111111-1111-4111-8111-111111111111 browser)"
export K6_BEARER_TOKEN

mkdir -p "${RESULTS}"
SUMMARY="${RESULTS}/pt-001-${RUN_ID}-summary.json"
RAW="${RESULTS}/pt-001-${RUN_ID}-raw.ndjson"
ARTIFACT="${RESULTS}/pt-001-${RUN_ID}-artifact.json"

echo "==> PT-001 k6 run_id=${RUN_ID} rate=${RATE}/s duration=${DURATION} base=${BASE_URL}"
PT001_RATE="${RATE}" PT001_DURATION="${DURATION}" BASE_URL="${BASE_URL}" \
  k6 run \
  --env "BASE_URL=${BASE_URL}" \
  --env "RUN_ID=${RUN_ID}" \
  --env "K6_BEARER_TOKEN=${K6_BEARER_TOKEN}" \
  --env "PT001_RATE=${RATE}" \
  --env "PT001_DURATION=${DURATION}" \
  --summary-export "${SUMMARY}" \
  --out "json=${RAW}" \
  "${K6_SCRIPT}"

BASE_URL="${BASE_URL}" PT001_RATE="${RATE}" PT001_DURATION="${DURATION}" \
  node "${ROOT}/load-tests/scripts/write-pt001-artifact.mjs" \
  "${RUN_ID}" "${SUMMARY}" "${RAW}" "${ARTIFACT}"

echo "PT-001 smoke complete. Attach artifact index: ${ARTIFACT}"
