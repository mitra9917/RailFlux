#!/usr/bin/env bash
# Wait for ALB target group healthy (M5 #46 acceptance helper).
set -euo pipefail

# shellcheck source=cfn-lib.sh
source "$(dirname "$0")/cfn-lib.sh"

PROFILE=""
SESSION=""
NO_PREFLIGHT=0

usage() {
  cat <<'EOF'
Usage:
  aws-ecs-alb-smoke.sh --profile aws-baseline|aws-optimized --session NAME

Polls ELB target health for the session ECS stack (expects healthy targets).
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)
      PROFILE="$2"
      shift 2
      ;;
    --session)
      SESSION="$2"
      shift 2
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

if [[ -z "${PROFILE}" || -z "${SESSION}" ]]; then
  usage >&2
  exit 1
fi

if (( NO_PREFLIGHT == 0 )); then
  railflux_preflight_caller
fi

case "${PROFILE}" in
  aws-baseline)
    STACK="$(railflux_module_stack_name ecs-baseline "${SESSION}")"
    TG_KEY="MonolithTargetGroupArn"
    ;;
  aws-optimized)
    STACK="$(railflux_module_stack_name ecs-optimized "${SESSION}")"
    TG_KEY="EdgeTargetGroupArn"
    ;;
  *)
    echo "Profile must be aws-baseline or aws-optimized." >&2
    exit 1
    ;;
esac

TG_ARN="$(railflux_cfn_output "${STACK}" "${TG_KEY}")"
if [[ -z "${TG_ARN}" || "${TG_ARN}" == None ]]; then
  echo "Stack ${STACK} missing ${TG_KEY}." >&2
  exit 1
fi

echo "==> Waiting for healthy targets tg=${TG_ARN}"
deadline=$((SECONDS + 600))
while (( SECONDS < deadline )); do
  healthy="$(aws elbv2 describe-target-health \
    --target-group-arn "${TG_ARN}" \
    --region "${RAILFLUX_APP_REGION}" \
    --query 'length(TargetHealthDescriptions[?TargetHealth.State==`healthy`])' \
    --output text)"
  if [[ "${healthy}" != 0 && "${healthy}" != "0" ]]; then
    ALB_DNS="$(railflux_cfn_output "${STACK}" AlbDnsName)"
    echo "ALB target healthy (count=${healthy}). AlbDnsName=${ALB_DNS}"
    echo "Smoke: curl -sf http://${ALB_DNS}/health/ready (may be blocked by CloudFront-only ALB SG from outside VPC)."
    exit 0
  fi
  sleep 15
done

echo "Timed out waiting for healthy targets on ${TG_ARN}" >&2
aws elbv2 describe-target-health --target-group-arn "${TG_ARN}" --region "${RAILFLUX_APP_REGION}" >&2 || true
exit 1
