#!/usr/bin/env bash
# ST-004 — direct ALB HTTPS without origin header must return 403 (M5 #54).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=cfn-lib.sh
source "$(dirname "$0")/cfn-lib.sh"

usage() {
  cat <<'EOF'
Usage:
  aws-security-st004-smoke.sh --profile aws-baseline|aws-optimized --session NAME
    [--origin-header-value SECRET] [--evidence PATH]

Requires a deployed alb-* stack. Secret defaults to env ORIGIN_HEADER_VALUE.
EOF
}

PROFILE=""
SESSION=""
ORIGIN_VALUE="${ORIGIN_HEADER_VALUE:-}"
EVIDENCE=""
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
    --origin-header-value)
      ORIGIN_VALUE="$2"
      shift 2
      ;;
    --evidence)
      EVIDENCE="$2"
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

if [[ -z "${ORIGIN_VALUE}" ]]; then
  echo "Set ORIGIN_HEADER_VALUE or pass --origin-header-value (same secret used at alb deploy)." >&2
  exit 1
fi

if (( NO_PREFLIGHT == 0 )); then
  railflux_preflight_caller
fi

case "${PROFILE}" in
  aws-baseline)
    STACK="$(railflux_module_stack_name alb-baseline "${SESSION}")"
    ;;
  aws-optimized)
    STACK="$(railflux_module_stack_name alb-optimized "${SESSION}")"
    ;;
  *)
    echo "Profile must be aws-baseline or aws-optimized." >&2
    exit 1
    ;;
esac

ALB_DNS="$(railflux_cfn_output "${STACK}" AlbDnsName)"
HEADER_NAME="$(railflux_cfn_output "${STACK}" OriginVerifyHeaderName)"
if [[ -z "${ALB_DNS}" || "${ALB_DNS}" == None ]]; then
  echo "Stack ${STACK} missing AlbDnsName." >&2
  exit 1
fi
if [[ -z "${HEADER_NAME}" || "${HEADER_NAME}" == None ]]; then
  HEADER_NAME="X-RailFlux-Origin-Verify"
fi

URL="https://${ALB_DNS}/health/ready"
echo "==> ST-004 ALB=${ALB_DNS} header=${HEADER_NAME}"

without="$(curl -sk -o /dev/null -w '%{http_code}' "${URL}")"
with="$(curl -sk -o /dev/null -w '%{http_code}' -H "${HEADER_NAME}: ${ORIGIN_VALUE}" "${URL}")"

echo "    without origin header: HTTP ${without} (expect 403)"
echo "    with origin header:    HTTP ${with} (expect 2xx)"

pass=0
if [[ "${without}" == "403" ]]; then
  pass=1
else
  echo "ST-004 FAIL: expected 403 without header, got ${without}" >&2
fi
if [[ "${with}" =~ ^2 ]]; then
  : ok
else
  pass=0
  echo "ST-004 FAIL: expected 2xx with header, got ${with}" >&2
fi

recorded_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
if [[ -n "${EVIDENCE}" ]]; then
  mkdir -p "$(dirname "${EVIDENCE}")"
  SESSION="${SESSION}" PROFILE="${PROFILE}" ALB_DNS="${ALB_DNS}" HEADER_NAME="${HEADER_NAME}" \
    WITHOUT="${without}" WITH="${with}" RECORDED_AT="${recorded_at}" ST004_OK="${pass}" \
    node -e "
const fs=require('fs');
const payload={
  testId:'ST-004',
  session:process.env.SESSION,
  profile:process.env.PROFILE,
  albDns:process.env.ALB_DNS,
  headerName:process.env.HEADER_NAME,
  withoutHeaderStatus:Number(process.env.WITHOUT),
  withHeaderStatus:Number(process.env.WITH),
  ok:process.env.ST004_OK==='1',
  recordedAt:process.env.RECORDED_AT,
};
fs.writeFileSync(process.argv[1], JSON.stringify(payload,null,2)+'\n');
" "${EVIDENCE}"
  echo "    evidence: ${EVIDENCE}"
fi

if (( pass == 1 )); then
  echo "ST-004 PASS"
  exit 0
fi
exit 1
