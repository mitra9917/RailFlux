#!/usr/bin/env bash
# Live CloudFormation progress for a stack (run in a second terminal while deploy runs).
set -euo pipefail

# shellcheck source=cfn-lib.sh
source "$(dirname "$0")/cfn-lib.sh"

STACK=""
REGION="${AWS_DEFAULT_REGION:-${RAILFLUX_APP_REGION}}"

usage() {
  cat <<'EOF'
Usage: aws-cfn-watch.sh --stack STACK_NAME [--region REGION]

Polls stack status, resource completion, and latest event every 5s until the stack
is no longer CREATE/UPDATE/DELETE in progress.

Disable spinner bar: RAILFLUX_NO_DEPLOY_PROGRESS=1
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --stack)
      STACK="$2"
      shift 2
      ;;
    --region)
      REGION="$2"
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

if [[ -z "${STACK}" ]]; then
  echo "--stack is required." >&2
  usage >&2
  exit 1
fi

railflux_require_aws_cli
echo "Watching ${STACK} (${REGION}) — Ctrl+C to stop."
railflux_cfn_watch_stack "${STACK}" "${REGION}" 1
