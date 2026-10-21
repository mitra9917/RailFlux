#!/usr/bin/env bash
# CloudWatch dashboard, SLO metrics namespace, and session alarms (M5 #50).
set -euo pipefail

# shellcheck source=cfn-lib.sh
source "$(dirname "$0")/cfn-lib.sh"

usage() {
  cat <<'EOF'
Usage:
  aws-observability-smoke.sh --session NAME [--run-id ID]

Verifies observability stack outputs and alarm/dashboard presence.
EOF
}

SESSION=""
RUN_ID=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --session)
      SESSION="$2"
      shift 2
      ;;
    --run-id)
      RUN_ID="$2"
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

if [[ -z "${SESSION}" ]]; then
  usage >&2
  exit 1
fi

if [[ -z "${RUN_ID}" ]]; then
  RUN_ID="${SESSION}"
fi

railflux_preflight_caller

STACK="$(railflux_module_stack_name observability "${SESSION}")"
REGION="${RAILFLUX_APP_REGION}"

if ! aws cloudformation describe-stacks --stack-name "${STACK}" --region "${REGION}" >/dev/null 2>&1; then
  echo "Observability stack ${STACK} not found." >&2
  exit 1
fi

NS="$(railflux_cfn_output "${STACK}" MetricsNamespace)"
DASH="$(railflux_cfn_output "${STACK}" DashboardName)"
echo "==> Metrics namespace: ${NS}"
echo "==> Dashboard: ${DASH}"

aws cloudwatch describe-alarms \
  --alarm-name-prefix "railflux-${SESSION}-" \
  --region "${REGION}" \
  --query 'MetricAlarms[].{Name:AlarmName,State:StateValue}' \
  --output table

echo "Observability smoke OK (session=${SESSION}, run_id=${RUN_ID})."
