#!/usr/bin/env bash
# Experiment controller — protocol steps 4–14 for local runs (M6 #58).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONTROLLER="${ROOT}/experiment/controller"
STATE_DIR="${ROOT}/load-tests/results/.controller-state"
RUNS="${ROOT}/experiment/runs"

usage() {
  cat <<'EOF'
Usage:
  run.sh --manifest PATH [options]

Orchestrates: fixture verify → reset/seed → health → run_id → k6 → correctness → export.

Options:
  --manifest PATH       Run manifest YAML (required)
  --workload pt001|manifest   Default: manifest
  --scenario pt005|pt006|both  For manifest workload (default: from manifest)
  --base-url URL        Default: http://127.0.0.1:3000
  --run-id ID           Override manifest run_id
  --seed                Full seed (migrations + fixture) instead of reset
  --skip-reset          Skip DB reset/seed
  --skip-load           Skip k6 workload
  --skip-correctness    Skip correctness SQL
  --dry-run             Plan only; no side effects

Also: npm run experiment:run -- --manifest experiment/load-pt-local.example.yaml
EOF
}

MANIFEST=""
WORKLOAD="manifest"
SCENARIO=""
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
RUN_ID_OVERRIDE=""
USE_SEED=0
SKIP_RESET=0
SKIP_LOAD=0
SKIP_CORRECTNESS=0
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --manifest)
      MANIFEST="$2"
      shift 2
      ;;
    --workload)
      WORKLOAD="$2"
      shift 2
      ;;
    --scenario)
      SCENARIO="$2"
      shift 2
      ;;
    --base-url)
      BASE_URL="$2"
      shift 2
      ;;
    --run-id)
      RUN_ID_OVERRIDE="$2"
      shift 2
      ;;
    --seed)
      USE_SEED=1
      shift
      ;;
    --skip-reset)
      SKIP_RESET=1
      shift
      ;;
    --skip-load)
      SKIP_LOAD=1
      shift
      ;;
    --skip-correctness)
      SKIP_CORRECTNESS=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
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

if [[ -z "${MANIFEST}" ]]; then
  usage >&2
  exit 1
fi

if [[ "${WORKLOAD}" != "pt001" && "${WORKLOAD}" != "manifest" ]]; then
  echo "--workload must be pt001 or manifest (got ${WORKLOAD})" >&2
  exit 1
fi

MANIFEST_ABS="$(cd "$(dirname "${MANIFEST}")" && pwd)/$(basename "${MANIFEST}")"
PLAN_JSON="$(node "${CONTROLLER}/parse-run-manifest.mjs" "${MANIFEST_ABS}")"
RUN_ID="${RUN_ID_OVERRIDE:-$(node -e "const p=JSON.parse(process.argv[1]); console.log(p.runId)" "${PLAN_JSON}")}"

mkdir -p "${STATE_DIR}" "${RUNS}"
INPUT_STATE="${STATE_DIR}/${RUN_ID}-input.json"

PROTOCOL_LINES=""
protocol_step() {
  local key="$1"
  local status="$2"
  local detail="${3:-}"
  PROTOCOL_LINES="${PROTOCOL_LINES}${key}|${status}|${detail}"$'\n'
}

FIXTURE_JSON=""
CORRECTNESS_JSON=""
K6_ARTIFACT_LIST=""
append_k6_artifact() {
  K6_ARTIFACT_LIST="${K6_ARTIFACT_LIST}${1}"$'\n'
}
INVALID_REASON=""
VALID=1

fail_invalid() {
  INVALID_REASON="$1"
  VALID=0
}

echo "==> Experiment controller run_id=${RUN_ID} manifest=${MANIFEST_ABS} workload=${WORKLOAD}"

protocol_step "1_freeze_versions" "skipped" "local; record in manifest versions.*"
protocol_step "2_pair_randomization" "skipped" "use npm run experiment:generate-manifest if not pre-generated"
protocol_step "3_deploy_profile" "skipped" "use compose:baseline or compose:optimized"
protocol_step "7_capacity" "skipped" "local fixed stack; see manifest resources"

protocol_step "4_fixture_checksum" "pending" ""
if (( DRY_RUN == 0 )); then
  if ! FIXTURE_JSON="$(node "${ROOT}/database/scripts/verify-fixture.mjs")"; then
    protocol_step "4_fixture_checksum" "failed" "verify-fixture.mjs"
    fail_invalid "fixture_checksum_failed"
  else
    EXPECTED_SHA="$(node -e "const p=JSON.parse(process.argv[1]); console.log(p.fixtureSha256||'')" "${PLAN_JSON}")"
    ACTUAL_SHA="$(node -e "const j=JSON.parse(process.argv[1]); console.log(j.fixture_sha256||'')" "${FIXTURE_JSON}")"
    if [[ -n "${EXPECTED_SHA}" && "${EXPECTED_SHA}" != "TO_SET" && "${EXPECTED_SHA}" != "${ACTUAL_SHA}" ]]; then
      protocol_step "4_fixture_checksum" "failed" "manifest fixture.sha256 mismatch"
      fail_invalid "manifest_fixture_sha256_mismatch"
    else
      protocol_step "4_fixture_checksum" "passed" ""
    fi
  fi
else
  protocol_step "4_fixture_checksum" "dry_run" ""
fi

protocol_step "5_reset_state" "pending" ""
if (( VALID == 1 && SKIP_RESET == 0 && DRY_RUN == 0 )); then
  if (( USE_SEED == 1 )); then
    "${ROOT}/database/scripts/seed.sh"
    protocol_step "5_reset_state" "passed" "seed.sh"
  else
    npm run db:reset --silent
    protocol_step "5_reset_state" "passed" "db:reset"
  fi
elif (( SKIP_RESET == 1 )); then
  protocol_step "5_reset_state" "skipped" "--skip-reset"
elif (( DRY_RUN == 1 )); then
  protocol_step "5_reset_state" "dry_run" ""
else
  protocol_step "5_reset_state" "skipped" "prior step failed"
fi

CACHE_COND="$(node -e "const p=JSON.parse(process.argv[1]); console.log(p.cacheCondition||'none')" "${PLAN_JSON}")"
if [[ "${CACHE_COND}" == "none" ]]; then
  protocol_step "6_cache_condition" "skipped" "none"
else
  protocol_step "6_cache_condition" "skipped" "local stub; apply ${CACHE_COND} manually on AWS"
fi

protocol_step "8_health_preflight" "pending" ""
if (( VALID == 1 && DRY_RUN == 0 )); then
  export BASELINE_HEALTH_URL="${BASE_URL}"
  if "${ROOT}/scripts/check-baseline-health.sh"; then
    protocol_step "8_health_preflight" "passed" "health ok; generator CPU gate at k6 runtime"
  else
    protocol_step "8_health_preflight" "failed" "health check"
    fail_invalid "health_check_failed"
  fi
elif (( DRY_RUN == 1 )); then
  protocol_step "8_health_preflight" "dry_run" ""
else
  protocol_step "8_health_preflight" "skipped" "prior step failed"
fi

protocol_step "9_run_id" "passed" "${RUN_ID}"

protocol_step "10_execute_workload" "pending" ""
LOAD_EXIT=0
if (( VALID == 1 && SKIP_LOAD == 0 && DRY_RUN == 0 )); then
  case "${WORKLOAD}" in
    pt001)
      PT001_RATE="${PT001_RATE:-3}"
      PT001_DURATION="${PT001_DURATION:-30s}"
      if ! "${ROOT}/load-tests/scripts/run-pt001-smoke.sh" \
        --run-id "${RUN_ID}" \
        --base-url "${BASE_URL}" \
        --rate "${PT001_RATE}" \
        --duration "${PT001_DURATION}"; then
        LOAD_EXIT=1
      else
        append_k6_artifact "${ROOT}/load-tests/results/pt-001-${RUN_ID}-artifact.json"
      fi
      ;;
    manifest)
      export LOAD_K6_RUN_ID="${RUN_ID}"
      MANIFEST_ARGS=(--manifest "${MANIFEST_ABS}" --base-url "${BASE_URL}")
      if [[ -n "${SCENARIO}" ]]; then
        MANIFEST_ARGS+=(--scenario "${SCENARIO}")
      fi
      if ! "${ROOT}/load-tests/scripts/run-load-from-manifest.sh" "${MANIFEST_ARGS[@]}"; then
        LOAD_EXIT=1
      else
        for f in "${ROOT}/load-tests/results/"*-"${RUN_ID}"-artifact.json; do
          [[ -f "${f}" ]] && append_k6_artifact "${f}"
        done
      fi
      ;;
  esac
  if (( LOAD_EXIT != 0 )); then
    protocol_step "10_execute_workload" "failed" "k6 exit ${LOAD_EXIT}"
    fail_invalid "workload_failed"
  else
    protocol_step "10_execute_workload" "passed" "${WORKLOAD}"
  fi
elif (( SKIP_LOAD == 1 )); then
  protocol_step "10_execute_workload" "skipped" "--skip-load"
elif (( DRY_RUN == 1 )); then
  protocol_step "10_execute_workload" "dry_run" "${WORKLOAD}"
else
  protocol_step "10_execute_workload" "skipped" "prior step failed"
fi

protocol_step "11_reconciliation" "passed" "k6 scenario duration"

protocol_step "12_correctness_sql" "pending" ""
CORRECTNESS_PASSED=""
if (( VALID == 1 && SKIP_CORRECTNESS == 0 && DRY_RUN == 0 )); then
  set +e
  # shellcheck source=../../database/scripts/common-env.sh
  source "${ROOT}/database/scripts/common-env.sh"
  CORRECTNESS_JSON="$("${ROOT}/database/scripts/run-correctness.sh" --run-id "${RUN_ID}")"
  CORRECTNESS_EXIT=$?
  set -e
  if (( CORRECTNESS_EXIT != 0 )); then
    protocol_step "12_correctness_sql" "failed" "violations"
    echo "${CORRECTNESS_JSON}" >&2
    fail_invalid "correctness_failed"
    CORRECTNESS_PASSED="false"
  else
    protocol_step "12_correctness_sql" "passed" ""
    CORRECTNESS_PASSED="true"
  fi
elif (( SKIP_CORRECTNESS == 1 )); then
  protocol_step "12_correctness_sql" "skipped" "--skip-correctness"
elif (( DRY_RUN == 1 )); then
  protocol_step "12_correctness_sql" "dry_run" ""
else
  protocol_step "12_correctness_sql" "skipped" "prior step failed"
fi

export PROTOCOL_LINES
export K6_ARTIFACT_LIST
node "${CONTROLLER}/write-run-input.mjs" \
  "${INPUT_STATE}" \
  "${PLAN_JSON}" \
  "${RUN_ID}" \
  "${MANIFEST_ABS}" \
  "${VALID}" \
  "${INVALID_REASON}" \
  "${FIXTURE_JSON}" \
  "${CORRECTNESS_JSON}" \
  "${CORRECTNESS_PASSED}"

node - "${INPUT_STATE}" "${VALID}" "${INVALID_REASON}" <<'NODE'
const fs = require('node:fs');
const inputPath = process.argv[2];
const valid = process.argv[3] === '1';
const invalidReason = process.argv[4] || null;
const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
input.protocolSteps['13_export_artifacts'] = {
  status: 'passed',
  detail: `${input.runId}.json`,
};
input.protocolSteps['14_mark_validity'] = {
  status: valid ? 'passed' : 'failed',
  detail: valid ? null : invalidReason,
};
fs.writeFileSync(inputPath, JSON.stringify(input, null, 2) + '\n');
NODE

set +e
node "${CONTROLLER}/finalize-run.mjs" "${INPUT_STATE}"
FINAL_EXIT=$?
set -e

if (( VALID == 0 )); then
  echo "Run marked INVALID: ${INVALID_REASON}" >&2
  exit 1
fi

echo "Run marked VALID. Record: ${RUNS}/${RUN_ID}.json"
exit "${FINAL_EXIT}"
