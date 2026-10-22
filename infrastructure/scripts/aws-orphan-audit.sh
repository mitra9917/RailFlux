#!/usr/bin/env bash
# RailFlux orphan inventory (M5 #53). Wraps aws-orphan-audit.mjs with CLI preflight.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=cfn-lib.sh
source "$(dirname "$0")/cfn-lib.sh"

usage() {
  cat <<'EOF'
Usage:
  aws-orphan-audit.sh [--session NAME] [--json] [--no-preflight]

Inspect ap-south-1 and us-east-1 for RailFlux orphans. Exits non-zero if paid orphans remain.
Account budget stack railflux-account-budgets is allowlisted.
EOF
}

SESSION=""
JSON=0
NO_PREFLIGHT=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --session)
      SESSION="$2"
      shift 2
      ;;
    --json)
      JSON=1
      shift
      ;;
    --no-preflight)
      NO_PREFLIGHT=1
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

if (( NO_PREFLIGHT == 0 )); then
  railflux_preflight_caller
else
  railflux_require_aws_cli
fi

ARGS=()
if [[ -n "${SESSION}" ]]; then
  ARGS+=(--session "${SESSION}")
fi
if (( JSON == 1 )); then
  ARGS+=(--json)
fi

export RAILFLUX_APP_REGION
export RAILFLUX_EDGE_REGION
exec node "${ROOT}/infrastructure/scripts/aws-orphan-audit.mjs" "${ARGS[@]}"
