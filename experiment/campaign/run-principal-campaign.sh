#!/usr/bin/env bash
# Principal paired campaign — sequential isolated runs (M7 #64).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

usage() {
  cat <<'EOF'
Usage:
  run-principal-campaign.sh [--campaign-id ID] [--reps N] [--max-pairs N] [--dry-run]
    [--base-url URL] [--cells C1-L80-legit,...]

Requires frozen experiment/hypotheses.yaml, Docker MySQL, k6, API on BASE_URL.
Switch compose profile (baseline vs optimized) before each leg as printed in leg events.

Writes experiment/campaigns/<campaign_id>.json and run indexes under experiment/runs/.
EOF
}

CAMPAIGN_ID="principal-local-001"
REPS=""
MAX_PAIRS=""
DRY_RUN=0
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
CELLS=""
EXTRA=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --campaign-id)
      CAMPAIGN_ID="$2"
      shift 2
      ;;
    --reps)
      REPS="$2"
      shift 2
      ;;
    --max-pairs)
      MAX_PAIRS="$2"
      shift 2
      ;;
    --base-url)
      BASE_URL="$2"
      shift 2
      ;;
    --cells)
      CELLS="$2"
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
      EXTRA+=("$1")
      shift
      ;;
  esac
done

ARGS=(--campaign-id "${CAMPAIGN_ID}" --base-url "${BASE_URL}")
[[ -n "${REPS}" ]] && ARGS+=(--reps "${REPS}")
[[ -n "${MAX_PAIRS}" ]] && ARGS+=(--max-pairs "${MAX_PAIRS}")
[[ -n "${CELLS}" ]] && ARGS+=(--cells "${CELLS}")
[[ "${DRY_RUN}" -eq 1 ]] && ARGS+=(--dry-run)

export BASE_URL
export MYSQL_PORT="${MYSQL_PORT:-3307}"
export SYNTHETIC_JWT_SECRET="${SYNTHETIC_JWT_SECRET:-dev-only-change-me}"

echo "==> Principal campaign ${CAMPAIGN_ID} (sequential pairs; invalid runs archived in experiment/runs/)"
exec node "${ROOT}/experiment/campaign/run-principal-campaign.mjs" "${ARGS[@]}" "${EXTRA[@]}"
