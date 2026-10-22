#!/usr/bin/env bash
# ST-004 + ST-005 security smokes with evidence export (M5 #54).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ST004="${ROOT}/infrastructure/scripts/aws-security-st004-smoke.sh"
ST005="${ROOT}/infrastructure/scripts/aws-security-st005-smoke.sh"

usage() {
  cat <<'EOF'
Usage:
  aws-security-smoke.sh --profile aws-baseline|aws-optimized --session NAME
    [--origin-header-value SECRET] [--evidence-dir PATH] [--skip-st005]

Writes st004-evidence.json and st005-evidence.json under evidence dir (attach to smoke run).
EOF
}

PROFILE=""
SESSION=""
ORIGIN_VALUE="${ORIGIN_HEADER_VALUE:-}"
EVIDENCE_DIR="${ROOT}/experiment/artifacts/security-smoke"
SKIP_ST005=0

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
    --evidence-dir)
      EVIDENCE_DIR="$2"
      shift 2
      ;;
    --skip-st005)
      SKIP_ST005=1
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

mkdir -p "${EVIDENCE_DIR}"
ST004_EVIDENCE="${EVIDENCE_DIR}/st004-${SESSION}.json"
ST005_EVIDENCE="${EVIDENCE_DIR}/st005-${SESSION}.json"
SUMMARY="${EVIDENCE_DIR}/security-smoke-${SESSION}.json"

echo "==> Security smoke session=${SESSION} profile=${PROFILE}"
if [[ -n "${ORIGIN_VALUE}" ]]; then
  "${ST004}" --profile "${PROFILE}" --session "${SESSION}" \
    --origin-header-value "${ORIGIN_VALUE}" --evidence "${ST004_EVIDENCE}"
else
  "${ST004}" --profile "${PROFILE}" --session "${SESSION}" --evidence "${ST004_EVIDENCE}"
fi

st005_code=0
if (( SKIP_ST005 == 0 )); then
  if ! "${ST005}" --session "${SESSION}" --deployment-profile "${PROFILE}" --evidence "${ST005_EVIDENCE}"; then
    st005_code=1
  fi
else
  echo "==> Skip ST-005 (--skip-st005)"
fi

recorded_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
SKIP_ST005="${SKIP_ST005}" SESSION="${SESSION}" PROFILE="${PROFILE}" RECORDED_AT="${recorded_at}" \
  ST004_EVIDENCE="${ST004_EVIDENCE}" ST005_EVIDENCE="${ST005_EVIDENCE}" SUMMARY="${SUMMARY}" \
  node -e "
const fs=require('fs');
const st004=JSON.parse(fs.readFileSync(process.env.ST004_EVIDENCE,'utf8'));
let st005=null;
let st005Ok=true;
if (process.env.SKIP_ST005==='0') {
  if (fs.existsSync(process.env.ST005_EVIDENCE)) {
    st005=JSON.parse(fs.readFileSync(process.env.ST005_EVIDENCE,'utf8'));
    st005Ok=!!st005.ok;
  } else st005Ok=false;
}
const summary={
  session: process.env.SESSION,
  profile: process.env.PROFILE,
  recordedAt: process.env.RECORDED_AT,
  st004,
  st005,
  ok: st004.ok && st005Ok,
};
fs.writeFileSync(process.env.SUMMARY, JSON.stringify(summary,null,2)+'\\n');
console.log('Security smoke summary:', process.env.SUMMARY);
"

if (( st005_code != 0 )); then
  exit 1
fi
echo "Security smoke PASS (evidence in ${EVIDENCE_DIR})"
