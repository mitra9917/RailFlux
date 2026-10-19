#!/usr/bin/env bash
# Exit 0 when baseline liveness and readiness succeed (for Compose / ALB-style checks).
set -euo pipefail

BASE_URL="${BASELINE_HEALTH_URL:-http://127.0.0.1:3000}"

live_code="$(curl -s -o /dev/null -w '%{http_code}' "${BASE_URL}/health/live")"
if [[ "$live_code" != "200" ]]; then
  echo "liveness failed: HTTP ${live_code}" >&2
  exit 1
fi

ready_code="$(curl -s -o /dev/null -w '%{http_code}' "${BASE_URL}/health/ready")"
if [[ "$ready_code" != "200" ]]; then
  echo "readiness failed: HTTP ${ready_code}" >&2
  exit 1
fi

echo "baseline health ok"
