#!/usr/bin/env bash
# Run baseline monolith (:3000) and optimized edge (:3001) together for Compare page demo.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/infrastructure/compose"

export COMPOSE_PROFILES=baseline,optimized
export BASELINE_HOST_PORT=3000
export EDGE_HOST_PORT=3001
export SYNTHETIC_JWT_SECRET="${SYNTHETIC_JWT_SECRET:-dev-only-change-me}"

echo "Starting MySQL + baseline (3000) + optimized stack (3001) [compare overlay]…"
docker compose -f docker-compose.yml -f docker-compose.compare.yml up -d --build mysql db-init baseline redis elasticmq sqs-init read booking worker edge

echo "Waiting for health…"
for i in $(seq 1 60); do
  if curl -sf http://127.0.0.1:3000/health/live >/dev/null && curl -sf http://127.0.0.1:3001/health/live >/dev/null; then
    echo "Baseline  http://127.0.0.1:3000/health/live OK"
    echo "Optimized http://127.0.0.1:3001/health/live OK"
    echo "Next: npm run dev:frontend → http://127.0.0.1:5173/compare"
    exit 0
  fi
  sleep 2
done

echo "Timed out waiting for APIs. Check: docker compose --project-directory infrastructure/compose ps"
exit 1
