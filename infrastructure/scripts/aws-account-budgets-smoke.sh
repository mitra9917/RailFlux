#!/usr/bin/env bash
# Verify RailFlux account budget stack (M5 #51).
set -euo pipefail

# shellcheck source=cfn-lib.sh
source "$(dirname "$0")/cfn-lib.sh"

usage() {
  cat <<'EOF'
Usage:
  aws-account-budgets-smoke.sh

Checks railflux-account-budgets stack and budget notifications in us-east-1.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
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

railflux_preflight_caller

STACK="$(railflux_module_stack_name account-budgets account)"
REGION="${RAILFLUX_EDGE_REGION}"

if ! aws cloudformation describe-stacks --stack-name "${STACK}" --region "${REGION}" >/dev/null 2>&1; then
  echo "Stack ${STACK} not found in ${REGION}. Run aws:deploy:account-budgets first." >&2
  exit 1
fi

echo "==> Stack ${STACK} (${REGION})"
aws cloudformation describe-stacks \
  --stack-name "${STACK}" \
  --region "${REGION}" \
  --query 'Stacks[0].Outputs' \
  --output table

echo "==> Budget railflux-account-monthly"
aws budgets describe-budget \
  --account-id "$(aws sts get-caller-identity --query Account --output text)" \
  --budget-name railflux-account-monthly \
  --output json \
  --query 'Budget.{Name:BudgetName,Limit:BudgetLimit.Amount,Unit:BudgetLimit.Unit,Notifications:NotificationsWithSubscribers[*].Notification}'

echo "Account budgets smoke OK."
