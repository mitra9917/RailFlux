#!/usr/bin/env bash
# M8 acceptance gate — frontend simulator (issue #75).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> M8 gate: npm run ci"
npm run ci

echo "==> M8 gate: frontend typecheck and production build"
npm run typecheck:frontend
npm run build:frontend

echo "==> M8 gate: M8 unit test bundle"
npm run test:m8-gate

BASE_URL="${M8_GATE_BASE_URL:-http://127.0.0.1:3000}"
if curl -sf "${BASE_URL}/health/live" >/dev/null 2>&1; then
  echo "==> M8 gate: live simulator API flow (${BASE_URL})"
  export M8_SIMULATOR_FLOW_INTEGRATION=1
  export M8_GATE_BASE_URL="${BASE_URL}"
  export SYNTHETIC_JWT_SECRET="${SYNTHETIC_JWT_SECRET:-dev-only-change-me}"
  npm run test:m8-simulator-flow
else
  echo "Skip live simulator flow (API not reachable at ${BASE_URL})."
  echo "  Start: npm run compose:optimized  (or compose:baseline)"
  echo "  Then re-run: npm run gate:m8"
fi

SIGNOFF="${M8_GATE_SIGNOFF:-}"
if [[ -n "${SIGNOFF}" && -f "${SIGNOFF}" ]]; then
  echo "==> M8 gate: sign-off verification (${SIGNOFF})"
  npm run experiment:verify-m8-acceptance -- --signoff "${SIGNOFF}"
else
  echo "Skip sign-off verification (complete docs/milestones/M8-gate-signoff.md, then:"
  echo "  M8_GATE_SIGNOFF=docs/milestones/M8-gate-signoff.md npm run gate:m8"
  echo "  See docs/runbooks/m8-gate.md"
fi

echo "M8 local gate checks complete."
