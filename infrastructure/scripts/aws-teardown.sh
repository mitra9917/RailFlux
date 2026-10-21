#!/usr/bin/env bash
# Delete RailFlux session CloudFormation stacks (M5 #41).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=cfn-lib.sh
source "$(dirname "$0")/cfn-lib.sh"

usage() {
  cat <<'EOF'
Usage:
  aws-teardown.sh --profile <aws-baseline|aws-optimized|aws-edge-waf|modules|all> --session NAME

Deletes the session stack in the correct region. Use profile=all to remove
application stacks, shared network/iam modules (ap-south-1), and edge WAF (us-east-1).

Options:
  --no-preflight   Skip sts get-caller-identity check.
EOF
}

PROFILE=""
SESSION=""
NO_PREFLIGHT=0

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
else
  railflux_require_aws_cli
fi

delete_stack() {
  local prof="$1"
  local stack
  local region
  stack="$(railflux_stack_name "${prof}" "${SESSION}")"
  region="$(railflux_region_for_profile "${prof}")"
  if aws cloudformation describe-stacks --stack-name "${stack}" --region "${region}" >/dev/null 2>&1; then
    echo "==> Deleting ${stack} (${region})"
    aws cloudformation delete-stack --stack-name "${stack}" --region "${region}"
    aws cloudformation wait stack-delete-complete --stack-name "${stack}" --region "${region}"
    echo "    deleted ${stack}"
  else
    echo "==> Skip ${stack} (not found in ${region})"
  fi
}

delete_module_stack() {
  local module="$1"
  local stack
  stack="$(railflux_module_stack_name "${module}" "${SESSION}")"
  if aws cloudformation describe-stacks --stack-name "${stack}" --region "${RAILFLUX_APP_REGION}" >/dev/null 2>&1; then
    echo "==> Deleting ${stack} (${RAILFLUX_APP_REGION})"
    aws cloudformation delete-stack --stack-name "${stack}" --region "${RAILFLUX_APP_REGION}"
    aws cloudformation wait stack-delete-complete --stack-name "${stack}" --region "${RAILFLUX_APP_REGION}"
    echo "    deleted ${stack}"
  else
    echo "==> Skip ${stack} (not found in ${RAILFLUX_APP_REGION})"
  fi
}

case "${PROFILE}" in
  aws-baseline | aws-optimized | aws-edge-waf)
    delete_stack "${PROFILE}"
    ;;
  modules)
    delete_module_stack rds-replica
    delete_module_stack rds
    delete_module_stack iam
    delete_module_stack network
    ;;
  all)
    delete_stack aws-baseline
    delete_stack aws-optimized
    delete_module_stack rds-replica
    delete_module_stack rds
    delete_module_stack iam
    delete_module_stack network
    delete_stack aws-edge-waf
    ;;
  *)
    echo "Unknown profile: ${PROFILE}" >&2
    exit 1
    ;;
esac

echo "Teardown complete for session=${SESSION}."
