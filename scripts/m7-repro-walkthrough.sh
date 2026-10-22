#!/usr/bin/env bash
# M7 #69 — reproducibility walkthrough gate (documentation + dry-run plan; optional live verify).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CAMPAIGN_ID="${REPRO_CAMPAIGN_ID:-repro-walkthrough-001}"
CAMPAIGN_JSON="${ROOT}/experiment/campaigns/${CAMPAIGN_ID}.json"

echo "==> M7 repro walkthrough: unit checks (runbook, verifier, notes template)"
npm run test:repro-walkthrough

echo "==> M7 repro walkthrough: principal smoke plan (dry-run, no Docker)"
npm run experiment:principal-campaign -- \
  --dry-run \
  --smoke \
  --campaign-id "${CAMPAIGN_ID}-plan"

if [[ -f "${CAMPAIGN_JSON}" ]]; then
  echo "==> M7 repro walkthrough: verify valid pair in ${CAMPAIGN_JSON}"
  npm run experiment:verify-repro-pair -- "${CAMPAIGN_JSON}"
else
  echo "Skip live pair verify (${CAMPAIGN_JSON} not present)."
  echo "After completing docs/runbooks/reproducibility-walkthrough.md, re-run:"
  echo "  npm run experiment:verify-repro-pair -- experiment/campaigns/${CAMPAIGN_ID}.json"
fi

echo "M7 reproducibility walkthrough gate checks complete."
