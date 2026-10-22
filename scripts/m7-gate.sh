#!/usr/bin/env bash
# M7 acceptance gate — campaign, analysis, report, reproducibility (issue #70).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> M7 gate: npm run ci"
npm run ci

echo "==> M7 gate: M7 unit test bundle"
npm run test:m7-gate

echo "==> M7 gate: reproducibility walkthrough (#69)"
npm run gate:m7-repro

CAMPAIGN="${M7_GATE_CAMPAIGN:-}"
if [[ -n "${CAMPAIGN}" && -f "${CAMPAIGN}" ]]; then
  echo "==> M7 gate: live acceptance (${CAMPAIGN})"
  npm run experiment:verify-m7-acceptance -- --campaign "${CAMPAIGN}"
else
  echo "Skip live M7 acceptance (set M7_GATE_CAMPAIGN to experiment/campaigns/<id>.json after sign-off)."
  echo "  See docs/runbooks/m7-gate.md and docs/milestones/M7-gate-signoff.md"
fi

echo "M7 local gate checks complete."
