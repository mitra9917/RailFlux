#!/usr/bin/env bash
# Run manifest + tooling preflight per docs/runbooks/deployment.md (M5 #52).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=cfn-lib.sh
source "$(dirname "$0")/cfn-lib.sh"

usage() {
  cat <<'EOF'
Usage:
  aws-deploy-preflight.sh --manifest PATH/to/run-manifest.yaml

Checks:
  - Run manifest required fields (run_id, session, expires_at, architecture)
  - npm run cfn:validate
  - AWS CLI identity (profile railflux)
  - Account budget stack railflux-account-budgets exists (M5 #51)

Does not deploy resources.
EOF
}

MANIFEST=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --manifest)
      MANIFEST="$2"
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

if [[ -z "${MANIFEST}" ]]; then
  usage >&2
  exit 1
fi

if [[ ! -f "${MANIFEST}" ]]; then
  echo "Manifest not found: ${MANIFEST}" >&2
  exit 1
fi

echo "==> Run manifest preflight"
node "${ROOT}/infrastructure/scripts/aws-run-manifest.mjs" "${MANIFEST}" check

echo "==> CloudFormation template validation"
(cd "${ROOT}" && npm run cfn:validate)

echo "==> AWS caller identity"
railflux_preflight_caller
aws sts get-caller-identity

BUDGET_STACK="$(railflux_module_stack_name account-budgets account)"
if aws cloudformation describe-stacks --stack-name "${BUDGET_STACK}" --region "${RAILFLUX_EDGE_REGION}" >/dev/null 2>&1; then
  echo "==> Account budgets stack present (${BUDGET_STACK})"
else
  echo "WARN: Account budget stack ${BUDGET_STACK} not found in ${RAILFLUX_EDGE_REGION}." >&2
  echo "      Deploy once: npm run aws:deploy:account-budgets -- --budget-alert-email YOU@example.com" >&2
fi

echo "Preflight complete. Manual checks (see deployment runbook): billing/credits, cost forecast, no other paid profile active."
