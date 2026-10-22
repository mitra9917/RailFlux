#!/usr/bin/env bash
# Teardown module stacks in runbook order and run orphan audit (M5 #53).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TEARDOWN="${ROOT}/infrastructure/scripts/aws-teardown.sh"
AUDIT="${ROOT}/infrastructure/scripts/aws-orphan-audit.sh"

usage() {
  cat <<'EOF'
Usage:
  aws-teardown-session.sh (--manifest PATH | --session NAME) [--dry-run|--execute] [--skip-audit] [--record-teardown]

Default is --dry-run (print planned teardown + audit commands only).

Does not delete railflux-account-budgets (account-level guardrails).
EOF
}

MANIFEST=""
SESSION=""
EXECUTE=0
SKIP_AUDIT=0
RECORD_TEARDOWN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --manifest)
      MANIFEST="$2"
      shift 2
      ;;
    --session)
      SESSION="$2"
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
    --skip-audit)
      SKIP_AUDIT=1
      shift
      ;;
    --record-teardown)
      RECORD_TEARDOWN=1
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

if [[ -n "${MANIFEST}" ]]; then
  # shellcheck disable=SC1090
  eval "$(node "${ROOT}/infrastructure/scripts/aws-run-manifest.mjs" "${MANIFEST}" shell)"
  SESSION="${RAILFLUX_SESSION}"
  RAILFLUX_OWNER="${RAILFLUX_OWNER:-railflux}"
elif [[ -z "${SESSION}" ]]; then
  usage >&2
  exit 1
else
  RAILFLUX_OWNER="${RAILFLUX_OWNER:-railflux}"
fi

run_cmd() {
  echo "+ $*"
  if (( EXECUTE == 1 )); then
    "$@"
  fi
}

echo "==> Teardown plan (session=${SESSION})"
if (( EXECUTE == 0 )); then
  echo "    (dry-run — pass --execute to delete stacks and run audit)"
fi

if [[ -n "${MANIFEST}" ]]; then
  run_cmd node "${ROOT}/infrastructure/scripts/aws-run-manifest.mjs" "${MANIFEST}" check
fi

# Reverse of deployment.md module order; profile=all covers modules + legacy roots + edge WAF.
run_cmd "${TEARDOWN}" --profile all --session "${SESSION}"

if (( SKIP_AUDIT == 0 )); then
  run_cmd "${AUDIT}" --session "${SESSION}"
fi

if (( EXECUTE == 1 && RECORD_TEARDOWN == 1 )) && [[ -n "${MANIFEST}" ]]; then
  run_cmd node "${ROOT}/infrastructure/scripts/aws-run-manifest.mjs" "${MANIFEST}" record-teardown \
    --auditor "${RAILFLUX_OWNER}"
fi

echo "Teardown session plan finished."
