#!/usr/bin/env bash
# M1 acceptance: contract + scaffold checks (no MySQL required).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
npm run ci
echo "M1 gate (CI portion): PASS"
echo "Optional: run ./database/scripts/load-fixture.sh with MySQL 8 to verify migrate+seed+reset."
