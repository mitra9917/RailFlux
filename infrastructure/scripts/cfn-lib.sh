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

# ISO8601 colons in tag Values break some AWS CLI --tags parsers; keep human-readable elsewhere.
railflux_cfn_tag_value_expires() {
  echo "${1//:/-}"
}

# Pairs for `aws cloudformation deploy --tags` (Key=Value, not CreateStack Key=,Value= syntax).
railflux_cfn_tags() {
  local run_id="$1"
  local owner="$2"
  local expires_at="$3"
  local profile="$4"
  local expires_tag
  expires_tag="$(railflux_cfn_tag_value_expires "${expires_at}")"
  echo "RunId=${run_id}"
  echo "Owner=${owner}"
  echo "ExpiresAt=${expires_tag}"
  echo "RailFluxProfile=${profile}"
  echo "Project=RailFlux"
}

# aws cloudformation deploy expects one --tags followed by Key=,Value= pairs (not repeated --tags).
# First argument is the name of the caller's array variable (bash 3–compatible, no namerefs).
railflux_cfn_deploy_tags_argv() {
  local dest_name="$1"
  shift
  eval "${dest_name}=(--tags)"
  while IFS= read -r tag; do
    eval "${dest_name}+=(\"\${tag}\")"
  done < <(railflux_cfn_tags "$@")
}

railflux_cfn_progress_enabled() {
  [[ -z "${RAILFLUX_NO_DEPLOY_PROGRESS:-}" ]] && [[ -t 1 ]]
}

railflux_cfn_progress_bar() {
  local done="$1"
  local total="$2"
  local width="${3:-28}"
  local filled=0
  local i=0
  local out=""

  done="${done:-0}"
  total="${total:-0}"
  done="${done%%[^0-9]*}"
  total="${total%%[^0-9]*}"
  if [[ -z "${done}" ]]; then done=0; fi
  if [[ -z "${total}" ]]; then total=0; fi
  if (( total < 1 )); then
    printf '%s' "[---------------------------]"
    return
  fi
  filled=$(( done * width / total ))
  if (( filled > width )); then
    filled=${width}
  fi
  while (( i < filled )); do
    out="${out}#"
    i=$((i + 1))
  done
  while (( i < width )); do
    out="${out}-"
    i=$((i + 1))
  done
  printf '[%s]' "${out}"
}

railflux_cfn_stack_resource_counts() {
  local stack="$1"
  local region="$2"
  aws cloudformation describe-stack-resources \
    --stack-name "${stack}" \
    --region "${region}" \
    --query "[length(StackResources[?ResourceStatus=='CREATE_COMPLETE' || ResourceStatus=='UPDATE_COMPLETE']), length(StackResources)]" \
    --output text 2>/dev/null || echo "0 0"
}

railflux_cfn_stack_status() {
  local stack="$1"
  local region="$2"
  aws cloudformation describe-stacks \
    --stack-name "${stack}" \
    --region "${region}" \
    --query 'Stacks[0].StackStatus' \
    --output text 2>/dev/null || echo "NOT_FOUND"
}

railflux_cfn_stack_latest_event() {
  local stack="$1"
  local region="$2"
  aws cloudformation describe-stack-events \
    --stack-name "${stack}" \
    --region "${region}" \
    --max-items 1 \
    --query 'StackEvents[0].[LogicalResourceId,ResourceStatus]' \
    --output text 2>/dev/null || echo "— —"
}

railflux_cfn_status_in_progress() {
  case "$1" in
    *_IN_PROGRESS) return 0 ;;
    *) return 1 ;;
  esac
}

# Print one progress line (overwrites when stdout is a TTY). interval=0 means single shot.
railflux_cfn_print_stack_progress_line() {
  local stack="$1"
  local region="$2"
  local started="$3"
  local elapsed counts done total pct status latest_id latest_st bar latest_raw

  elapsed=$(( $(date +%s) - started ))
  status="$(railflux_cfn_stack_status "${stack}" "${region}")"
  counts="$(railflux_cfn_stack_resource_counts "${stack}" "${region}" | tr '\t' ' ')"
  # AWS CLI --output text uses tabs; collapse so arithmetic never sees "0     0".
  counts="$(echo "${counts}" | awk '{print $1+0, $2+0}')"
  done="${counts%% *}"
  total="${counts##* }"
  if (( total > 0 )); then
    pct=$(( done * 100 / total ))
  else
    pct=0
  fi
  latest_raw="$(railflux_cfn_stack_latest_event "${stack}" "${region}")"
  latest_id="${latest_raw%%$'\t'*}"
  latest_st="${latest_raw#*$'\t'}"

  bar="$(railflux_cfn_progress_bar "${done}" "${total}")"
  if railflux_cfn_progress_enabled; then
    printf '\r  [%4ds] %s %3d%% (%s/%s) | %s | %s %s' \
      "${elapsed}" "${bar}" "${pct}" "${done}" "${total}" "${status}" "${latest_id}" "${latest_st}"
  else
    echo "  [${elapsed}s] ${pct}% (${done}/${total}) | ${status} | ${latest_id} ${latest_st}"
  fi
}

# Poll until stack leaves *_IN_PROGRESS (or never existed and deploy finished elsewhere).
railflux_cfn_watch_stack() {
  local stack="$1"
  local region="$2"
  local until_idle="${3:-0}"
  local started
  started=$(date +%s)

  while true; do
    railflux_cfn_print_stack_progress_line "${stack}" "${region}" "${started}"
    local status
    status="$(railflux_cfn_stack_status "${stack}" "${region}")"
    if (( until_idle == 1 )); then
      if [[ "${status}" != "NOT_FOUND" ]] && ! railflux_cfn_status_in_progress "${status}"; then
        break
      fi
    fi
    sleep 5
  done
  if railflux_cfn_progress_enabled; then
    printf '\n'
  fi
}

# Run `aws cloudformation deploy` with a live resource progress line in the same terminal.
railflux_cfn_deploy_with_progress() {
  local stack="$1"
  local region="$2"
  shift 2

  if ! railflux_cfn_progress_enabled; then
    aws cloudformation deploy "$@"
    return $?
  fi

  echo "CloudFormation deploy started (updates every 5s; CloudFront can take 15–20 min)."
  aws cloudformation deploy "$@" &
  local deploy_pid=$!
  local started
  started=$(date +%s)

  while kill -0 "${deploy_pid}" 2>/dev/null; do
    railflux_cfn_print_stack_progress_line "${stack}" "${region}" "${started}"
    sleep 5
  done

  printf '\n'
  wait "${deploy_pid}"
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
