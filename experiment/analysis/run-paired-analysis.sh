#!/usr/bin/env bash
# Paired bootstrap analysis (M7 #66).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

usage() {
  cat <<'EOF'
Usage:
  run-paired-analysis.sh --campaign PATH [--runs DIR] [--out PATH] [--load-level L80] [--dry-run]

Reads valid baseline/optimized pairs from campaign JSON + experiment/runs/*.result.json.
EOF
}

CAMPAIGN=""
RUNS="${ROOT}/experiment/runs"
OUT=""
HYPOTHESES=""
LOAD_LEVEL=""
CELL=""
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --campaign)
      CAMPAIGN="$2"
      shift 2
      ;;
    --runs)
      RUNS="$2"
      shift 2
      ;;
    --out)
      OUT="$2"
      shift 2
      ;;
    --hypotheses)
      HYPOTHESES="$2"
      shift 2
      ;;
    --load-level)
      LOAD_LEVEL="$2"
      shift 2
      ;;
    --cell)
      CELL="$2"
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

ARGS=(--campaign "${CAMPAIGN}" --runs "${RUNS}")
[[ -n "${OUT}" ]] && ARGS+=(--out "${OUT}")
[[ -n "${HYPOTHESES}" ]] && ARGS+=(--hypotheses "${HYPOTHESES}")
[[ -n "${LOAD_LEVEL}" ]] && ARGS+=(--load-level "${LOAD_LEVEL}")
[[ -n "${CELL}" ]] && ARGS+=(--cell "${CELL}")
[[ "${DRY_RUN}" -eq 1 ]] && ARGS+=(--dry-run)

exec node "${ROOT}/experiment/analysis/analyze-paired-campaign.mjs" "${ARGS[@]}"
