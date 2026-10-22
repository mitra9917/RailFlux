#!/usr/bin/env bash
# Results dashboard + cost parity (M7 #67).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

usage() {
  cat <<'EOF'
Usage:
  run-results-dashboard.sh --campaign PATH [--analysis PATH] [--runs DIR] [--out-dir DIR] [--dry-run]

Generates experiment/dashboard/output/<campaign>-dashboard.{json,html}
EOF
}

CAMPAIGN=""
ANALYSIS=""
RUNS="${ROOT}/experiment/runs"
OUT_DIR="${ROOT}/experiment/dashboard/output"
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --campaign)
      CAMPAIGN="$2"
      shift 2
      ;;
    --analysis)
      ANALYSIS="$2"
      shift 2
      ;;
    --runs)
      RUNS="$2"
      shift 2
      ;;
    --out-dir)
      OUT_DIR="$2"
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

if [[ -z "${CAMPAIGN}" ]]; then
  usage >&2
  exit 1
fi

ARGS=(--campaign "${CAMPAIGN}" --runs "${RUNS}" --out-dir "${OUT_DIR}")
[[ -n "${ANALYSIS}" ]] && ARGS+=(--analysis "${ANALYSIS}")
[[ "${DRY_RUN}" -eq 1 ]] && ARGS+=(--dry-run)

exec node "${ROOT}/experiment/dashboard/generate-results-dashboard.mjs" "${ARGS[@]}"
