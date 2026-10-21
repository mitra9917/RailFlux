#!/usr/bin/env bash
# Shared helpers for RailFlux CloudFormation wrappers (M5 #41).
set -euo pipefail

# shellcheck source=aws-env.sh
source "$(dirname "${BASH_SOURCE[0]}")/aws-env.sh"

RAILFLUX_APP_REGION="${RAILFLUX_APP_REGION:-ap-south-1}"
RAILFLUX_EDGE_REGION="${RAILFLUX_EDGE_REGION:-us-east-1}"
RAILFLUX_CFN_DIR="${RAILFLUX_CFN_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../cloudformation" && pwd)}"

railflux_stack_name() {
  local profile="$1"
  local session="$2"
  case "${profile}" in
    aws-baseline) echo "railflux-aws-baseline-${session}" ;;
    aws-optimized) echo "railflux-aws-optimized-${session}" ;;
    aws-edge-waf) echo "railflux-edge-waf-${session}" ;;
    *)
      echo "Unknown profile: ${profile}" >&2
      return 1
      ;;
  esac
}

railflux_module_stack_name() {
  local module="$1"
  local session="$2"
  case "${module}" in
    network) echo "railflux-network-${session}" ;;
    iam) echo "railflux-iam-${session}" ;;
    rds) echo "railflux-rds-${session}" ;;
    rds-replica) echo "railflux-rds-replica-${session}" ;;
    elasticache) echo "railflux-elasticache-${session}" ;;
    ecs-baseline) echo "railflux-ecs-baseline-${session}" ;;
    ecs-optimized) echo "railflux-ecs-optimized-${session}" ;;
    alb-baseline) echo "railflux-alb-baseline-${session}" ;;
    alb-optimized) echo "railflux-alb-optimized-${session}" ;;
    cloudfront-baseline) echo "railflux-cloudfront-baseline-${session}" ;;
    cloudfront-optimized) echo "railflux-cloudfront-optimized-${session}" ;;
    sqs-worker) echo "railflux-sqs-worker-${session}" ;;
    observability) echo "railflux-observability-${session}" ;;
    account-budgets) echo "railflux-account-budgets" ;;
    *)
      echo "Unknown module: ${module}" >&2
      return 1
      ;;
  esac
}

railflux_cloudfront_origin_prefix_list_id() {
  local region="${1:-${RAILFLUX_APP_REGION}}"
  railflux_require_aws_cli
  aws ec2 describe-managed-prefix-lists \
    --region "${region}" \
    --filters "Name=prefix-list-name,Values=com.amazonaws.global.cloudfront.origin-facing" \
    --query 'PrefixLists[0].PrefixListId' \
    --output text
}

railflux_template_for_profile() {
  local profile="$1"
  case "${profile}" in
    aws-baseline) echo "${RAILFLUX_CFN_DIR}/baseline/root.yaml" ;;
    aws-optimized) echo "${RAILFLUX_CFN_DIR}/optimized/root.yaml" ;;
    aws-edge-waf) echo "${RAILFLUX_CFN_DIR}/edge/waf.yaml" ;;
    *)
      echo "Unknown profile: ${profile}" >&2
      return 1
      ;;
  esac
}

railflux_region_for_profile() {
  local profile="$1"
  case "${profile}" in
    aws-edge-waf) echo "${RAILFLUX_EDGE_REGION}" ;;
    aws-baseline | aws-optimized) echo "${RAILFLUX_APP_REGION}" ;;
    *)
      echo "Unknown profile: ${profile}" >&2
      return 1
      ;;
  esac
}

railflux_cfn_tags() {
  local run_id="$1"
  local owner="$2"
  local expires_at="$3"
  local profile="$4"
  echo "Key=RunId,Value=${run_id}"
  echo "Key=Owner,Value=${owner}"
  echo "Key=ExpiresAt,Value=${expires_at}"
  echo "Key=RailFluxProfile,Value=${profile}"
  echo "Key=Project,Value=RailFlux"
}

railflux_require_aws_cli() {
  if ! command -v aws >/dev/null 2>&1; then
    echo "AWS CLI is required. Install and configure credentials, then retry." >&2
    exit 1
  fi
}

railflux_preflight_caller() {
  railflux_require_aws_cli
  if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo "AWS credentials failed for profile=${AWS_PROFILE:-<unset>} region=${AWS_DEFAULT_REGION}." >&2
    echo "RailFlux expects ~/.aws/credentials profile [railflux] on account 856073125851 (user railflux-cli)." >&2
    echo "Fix: export AWS_PROFILE=railflux && aws sts get-caller-identity" >&2
    echo "Or set RAILFLUX_AWS_PROFILE. Your [default] profile keys may be expired—do not use default for this repo." >&2
    echo "Cursor AWS MCP (OAuth) is separate; deploy scripts use the AWS CLI profile above." >&2
    exit 1
  fi
}

railflux_cfn_output() {
  local stack_name="$1"
  local output_key="$2"
  local region="${3:-${RAILFLUX_APP_REGION}}"
  aws cloudformation describe-stacks \
    --stack-name "${stack_name}" \
    --region "${region}" \
    --query "Stacks[0].Outputs[?OutputKey=='${output_key}'].OutputValue | [0]" \
    --output text
}

railflux_require_network_stack() {
  local session="$1"
  local stack
  stack="$(railflux_module_stack_name network "${session}")"
  if ! aws cloudformation describe-stacks --stack-name "${stack}" --region "${RAILFLUX_APP_REGION}" >/dev/null 2>&1; then
    echo "Network stack ${stack} not found. Run aws:deploy:network first." >&2
    exit 1
  fi
}

railflux_require_rds_primary_stack() {
  local session="$1"
  local stack
  stack="$(railflux_module_stack_name rds "${session}")"
  if ! aws cloudformation describe-stacks --stack-name "${stack}" --region "${RAILFLUX_APP_REGION}" >/dev/null 2>&1; then
    echo "RDS primary stack ${stack} not found. Run aws:deploy:rds first." >&2
    exit 1
  fi
}
