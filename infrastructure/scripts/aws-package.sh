#!/usr/bin/env bash
# Package nested CloudFormation templates to S3 for TemplateURL deploys (M5 #41 stub).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=cfn-lib.sh
source "$(dirname "$0")/cfn-lib.sh"

usage() {
  cat <<'EOF'
Usage:
  aws-package.sh --template PATH --bucket BUCKET [--prefix PREFIX] [--region REGION]

Runs `aws cloudformation package` and writes packaged YAML to stdout path
(default: packaged.yaml beside template).

Nested stacks require S3 TemplateURL before root deploy in AWS; root-only
layout stubs in M5 #41 do not require packaging yet.
EOF
}

TEMPLATE=""
BUCKET=""
PREFIX="railflux-cfn"
REGION="${RAILFLUX_APP_REGION}"
OUTPUT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --template)
      TEMPLATE="$2"
      shift 2
      ;;
    --bucket)
      BUCKET="$2"
      shift 2
      ;;
    --prefix)
      PREFIX="$2"
      shift 2
      ;;
    --region)
      REGION="$2"
      shift 2
      ;;
    --output)
      OUTPUT="$2"
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

if [[ -z "${TEMPLATE}" || -z "${BUCKET}" ]]; then
  usage >&2
  exit 1
fi

if [[ ! -f "${TEMPLATE}" ]]; then
  echo "Template not found: ${TEMPLATE}" >&2
  exit 1
fi

if [[ -z "${OUTPUT}" ]]; then
  OUTPUT="$(dirname "${TEMPLATE}")/packaged.yaml"
fi

railflux_preflight_caller

aws cloudformation package \
  --template-file "${TEMPLATE}" \
  --s3-bucket "${BUCKET}" \
  --s3-prefix "${PREFIX}" \
  --output-template-file "${OUTPUT}" \
  --region "${REGION}"

echo "Packaged template: ${OUTPUT}"
