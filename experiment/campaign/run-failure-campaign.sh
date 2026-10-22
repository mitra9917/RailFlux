#!/usr/bin/env bash
# Selected failure tests at ~80% load (M7 #65).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

usage() {
  cat <<'EOF'
Usage:
  run-failure-campaign.sh [--campaign-id ID] [--tests FT-005,...] [--max-runs N] [--dry-run]
    [--base-url URL] [--duration-seconds N] [--injection-offset-seconds N] [--smoke]

One fault at a time at frozen L80 (~80%) RPS. Switch compose profile before each run
to match manifest architecture. Inject fault at offset (default 60s) per runbook.
EOF
}

CAMPAIGN_ID="failure-local-001"
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
DRY_RUN=0
MAX_RUNS=""
TESTS=""
DURATION_SECONDS=""
INJECTION_OFFSET=""
SMOKE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --campaign-id)
      CAMPAIGN_ID="$2"
      shift 2
      ;;
    --base-url)
      BASE_URL="$2"
      shift 2
      ;;
    --max-runs)
      MAX_RUNS="$2"
      shift 2
      ;;
    --tests)
      TESTS="$2"
      shift 2
      ;;
    --duration-seconds)
      DURATION_SECONDS="$2"
      shift 2
      ;;
    --injection-offset-seconds)
      INJECTION_OFFSET="$2"
      shift 2
      ;;
    --smoke)
      SMOKE=1
      shift
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

ARGS=(--campaign-id "${CAMPAIGN_ID}" --base-url "${BASE_URL}")
[[ -n "${MAX_RUNS}" ]] && ARGS+=(--max-runs "${MAX_RUNS}")
[[ -n "${TESTS}" ]] && ARGS+=(--tests "${TESTS}")
[[ -n "${DURATION_SECONDS}" ]] && ARGS+=(--duration-seconds "${DURATION_SECONDS}")
[[ -n "${INJECTION_OFFSET}" ]] && ARGS+=(--injection-offset-seconds "${INJECTION_OFFSET}")
[[ "${SMOKE}" -eq 1 ]] && ARGS+=(--smoke)
[[ "${DRY_RUN}" -eq 1 ]] && ARGS+=(--dry-run)

export BASE_URL
export MYSQL_PORT="${MYSQL_PORT:-3307}"
export SYNTHETIC_JWT_SECRET="${SYNTHETIC_JWT_SECRET:-dev-only-change-me}"
if [[ "${SMOKE}" -eq 1 ]]; then
  export GENERATOR_PREFLIGHT_MAX_HOST_LOAD_PCT="${GENERATOR_PREFLIGHT_MAX_HOST_LOAD_PCT:-85}"
fi

if [[ "${SMOKE}" -eq 1 ]]; then
  echo "==> Failure campaign ${CAMPAIGN_ID} (smoke: FT-005, 60s, inject @20s; switch compose per run)"
else
  echo "==> Failure campaign ${CAMPAIGN_ID} (sequential FT runs at ~80% load; inject per runbook)"
fi
exec node "${ROOT}/experiment/campaign/run-failure-campaign.mjs" "${ARGS[@]}"
