#!/usr/bin/env bash
# MySQL + Redis + ElasticMQ + read/booking/worker/edge via Compose (M4 optimized profile).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_DIR="${ROOT}/infrastructure/compose"
COMPOSE_FILE="${COMPOSE_DIR}/docker-compose.yml"
ENV_OPTIMIZED="${COMPOSE_DIR}/.env.optimized.example"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Install Docker Desktop, then retry." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker engine is not running." >&2
  exit 1
fi

if [[ ! -f "${COMPOSE_DIR}/.env" ]]; then
  echo "Creating ${COMPOSE_DIR}/.env from .env.optimized.example"
  cp "${ENV_OPTIMIZED}" "${COMPOSE_DIR}/.env"
fi

# shellcheck disable=SC1091
source "${COMPOSE_DIR}/.env"
EDGE_PORT="${EDGE_HOST_PORT:-3000}"

if lsof -iTCP:"${EDGE_PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  if ! docker ps --format '{{.Names}}' | grep -qx railflux-edge; then
    echo "Port ${EDGE_PORT} is in use by another process (not railflux-edge)." >&2
    echo "Stop baseline compose/dev or set EDGE_HOST_PORT in infrastructure/compose/.env." >&2
    lsof -iTCP:"${EDGE_PORT}" -sTCP:LISTEN >&2 || true
    exit 1
  fi
fi

echo "==> Compose optimized profile (MySQL + Redis + ElasticMQ + read/booking/worker/edge on :${EDGE_PORT})"
docker compose -f "${COMPOSE_FILE}" --project-directory "${COMPOSE_DIR}" up -d --build

echo "==> Waiting for edge readiness"
deadline=$((SECONDS + 180))
until curl -sf "http://127.0.0.1:${EDGE_PORT}/health/ready" >/dev/null; do
  if (( SECONDS >= deadline )); then
    echo "Timed out waiting for edge readiness on :${EDGE_PORT}" >&2
    docker compose -f "${COMPOSE_FILE}" --project-directory "${COMPOSE_DIR}" ps >&2 || true
    exit 1
  fi
  sleep 2
done

HEALTH_OK_MESSAGE="Optimized edge health ok" \
  BASELINE_HEALTH_URL="http://127.0.0.1:${EDGE_PORT}" \
  "${ROOT}/scripts/check-baseline-health.sh"
echo ""
"${ROOT}/scripts/compose-status.sh" | tail -n +5 | head -n 24
echo ""
echo "Profile: OPTIMIZED (split read/booking/worker — our cloud-native design, not IRCTC)."
echo "Browser: http://127.0.0.1:${EDGE_PORT}/health/ready  (API has no HTML UI at /)"
echo "Use :${EDGE_PORT} only; read/booking are internal. Example (mint JWT from repo root):"
echo "  export SYNTHETIC_JWT_SECRET=\${SYNTHETIC_JWT_SECRET:-dev-only-change-me}"
echo "  TOKEN=\$(node scripts/mint-synthetic-jwt.mjs 11111111-1111-4111-8111-111111111111)"
echo "  curl -s -H \"Authorization: Bearer \$TOKEN\" \\"
echo "    \"http://127.0.0.1:${EDGE_PORT}/v1/search?from=SAB&to=SAA&date=2026-04-01\""
