#!/usr/bin/env bash
# M6 acceptance gate — experiment engine (issue #62).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MANIFEST="${M6_GATE_MANIFEST:-experiment/load-pt-local.example.yaml}"
GENERATED="${ROOT}/experiment/generated-gate"

echo "==> M6 gate: npm run ci"
npm run ci

echo "==> M6 gate: experiment engine unit tests"
npm run test:m6-gate

if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  echo "Skip M6 live smoke (Docker not available). Unit gate passed."
  exit 0
fi

if ! docker ps --format '{{.Names}}' | grep -qx railflux-mysql; then
  echo "Skip M6 live smoke (railflux-mysql not running)."
  echo "Start: npm run compose:baseline  (or npm run db:up && npm run db:load)"
  echo "Then re-run: npm run gate:m6"
  exit 0
fi

if ! command -v k6 >/dev/null 2>&1; then
  echo "Skip M6 live smoke (k6 not on PATH). Install k6 and re-run gate:m6."
  exit 0
fi

BASE_URL="${M6_GATE_BASE_URL:-http://127.0.0.1:3000}"
if ! curl -sf "${BASE_URL}/health/live" >/dev/null; then
  echo "Skip M6 live smoke (API not reachable at ${BASE_URL})."
  echo "Start baseline/edge stack, then re-run: npm run gate:m6"
  exit 0
fi

export MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
export MYSQL_PORT="${MYSQL_PORT:-3307}"
export MYSQL_USER="${MYSQL_USER:-railflux}"
export MYSQL_PASSWORD="${MYSQL_PASSWORD:-railflux}"
export MYSQL_DATABASE="${MYSQL_DATABASE:-railflux}"
export SYNTHETIC_JWT_SECRET="${SYNTHETIC_JWT_SECRET:-dev-only-change-me}"
export BASE_URL

GATE_TS="$(date -u +%Y%m%dT%H%M%SZ)"
GATE_RUN_ID="m6-gate-${GATE_TS}"

echo "==> M6 gate: clean reset (run_id=${GATE_RUN_ID})"
npm run db:reset --silent

echo "==> M6 gate: manifest generator export"
rm -rf "${GENERATED}"
npm run experiment:generate-manifest -- \
  --pair-id "m6-gate-pair" \
  --randomization-seed 772910 \
  --session-name "m6-gate-local" \
  --output-dir "${GENERATED}" >/dev/null
test -f "${GENERATED}/run-m6-gate-pair-baseline.yaml"
test -f "${GENERATED}/run-m6-gate-pair-optimized.yaml"

echo "==> M6 gate: PT-001 smoke + generator preflight"
npm run load:pt001 -- --run-id "${GATE_RUN_ID}-pt001" --base-url "${BASE_URL}"

echo "==> M6 gate: experiment controller (reset → preflight → PT-001 → export)"
npm run experiment:run -- \
  --manifest "${MANIFEST}" \
  --workload pt001 \
  --base-url "${BASE_URL}" \
  --run-id "${GATE_RUN_ID}"

INDEX="${ROOT}/experiment/runs/${GATE_RUN_ID}.json"
RESULT="${ROOT}/experiment/runs/${GATE_RUN_ID}.result.json"
test -f "${INDEX}"
test -f "${RESULT}"

node "${ROOT}/experiment/controller/validate-result-file.mjs" "${RESULT}"

echo "M6 gate checks complete (live smoke + ${RESULT})."
