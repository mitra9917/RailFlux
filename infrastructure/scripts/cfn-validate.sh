#!/usr/bin/env bash
# Validate RailFlux CloudFormation templates (M5 #41).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CFN_DIR="${ROOT}/infrastructure/cloudformation"

TEMPLATES=()
while IFS= read -r line; do
  TEMPLATES+=("${line}")
done < <(find "${CFN_DIR}" -name '*.yaml' -type f | sort)

if ((${#TEMPLATES[@]} == 0)); then
  echo "No CloudFormation templates under ${CFN_DIR}" >&2
  exit 1
fi

echo "==> Structural validation (${#TEMPLATES[@]} templates)"
for template in "${TEMPLATES[@]}"; do
  rel="${template#"${ROOT}/"}"
  grep -q 'AWSTemplateFormatVersion' "${template}" || {
    echo "Missing AWSTemplateFormatVersion: ${rel}" >&2
    exit 1
  }
  grep -q '^Resources:' "${template}" || {
    echo "Missing Resources section: ${rel}" >&2
    exit 1
  }
  echo "  ok  ${rel}"
done

# shellcheck source=cfn-lib.sh
source "$(dirname "$0")/cfn-lib.sh"

if command -v aws >/dev/null 2>&1; then
  echo "==> AWS CloudFormation validate-template (when credentials available)"
  if aws sts get-caller-identity >/dev/null 2>&1; then
    for template in "${TEMPLATES[@]}"; do
      rel="${template#"${ROOT}/"}"
      if grep -qE '^Resources: \{\}[[:space:]]*$' "${template}"; then
        echo "  aws skip  ${rel} (empty Resources — metadata stub, not deployable)"
        continue
      fi
      region="${RAILFLUX_APP_REGION}"
      if [[ "${template}" == *"/edge/"* ]]; then
        region="${RAILFLUX_EDGE_REGION}"
      elif [[ "${template}" == *"/shared/account-budgets.yaml" ]]; then
        region="${RAILFLUX_EDGE_REGION}"
      fi
      aws cloudformation validate-template \
        --template-body "file://${template}" \
        --region "${region}" >/dev/null
      echo "  aws ok  ${rel} (${region})"
    done
  else
    echo "  skip  AWS CLI present but credentials unavailable (structural checks passed)"
  fi
else
  echo "  skip  AWS CLI not installed (structural checks passed)"
fi

echo "CloudFormation validation complete."
