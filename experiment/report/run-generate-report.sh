#!/usr/bin/env bash
# Experiment report from measured artifacts (M7 #68).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

usage() {
  cat <<'EOF'
Usage:
  run-generate-report.sh --campaign PATH [--analysis PATH] [--dashboard PATH] [--runs DIR] [--out PATH] [--dry-run]

Writes experiment/reports/<campaign_id>-report.md (measured evidence only).
EOF
}

CAMPAIGN=""
RUNS="${ROOT}/experiment/runs"
ANALYSIS=""
DASHBOARD=""
OUT=""
HYPOTHESES="${ROOT}/experiment/hypotheses.yaml"
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
    --analysis)
      ANALYSIS="$2"
      shift 2
      ;;
    --dashboard)
      DASHBOARD="$2"
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

ARGS=(--campaign "${CAMPAIGN}" --runs "${RUNS}" --hypotheses "${HYPOTHESES}")
[[ -n "${ANALYSIS}" ]] && ARGS+=(--analysis "${ANALYSIS}")
[[ -n "${DASHBOARD}" ]] && ARGS+=(--dashboard "${DASHBOARD}")
[[ -n "${OUT}" ]] && ARGS+=(--out "${OUT}")
[[ "${DRY_RUN}" -eq 1 ]] && ARGS+=(--dry-run)

exec node "${ROOT}/experiment/report/generate-experiment-report.mjs" "${ARGS[@]}"
