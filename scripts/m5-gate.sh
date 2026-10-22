#!/usr/bin/env bash
# M5 acceptance gate — IaC validation + CFN tests (issue #55). AWS path: npm run aws:gate:m5.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> M5 gate: npm run ci"
npm run ci

echo "==> M5 gate: CloudFormation validate"
npm run cfn:validate

echo "==> M5 gate: infrastructure unit tests (CFN + automation)"
npm run test:m5-gate

echo "M5 local gate checks complete."
echo "For paid AWS acceptance (baseline → optimized deploy/teardown, orphan audit):"
echo "  npm run aws:gate:m5 -- --baseline-manifest experiment/m5-gate-baseline.example.yaml \\"
echo "    --optimized-manifest experiment/m5-gate-optimized.example.yaml"
echo "  Add --execute after filling manifests and export deploy env (see docs/runbooks/m5-gate.md)."
