#!/usr/bin/env bash
# MySQL + fixture load + baseline API via Compose (M2 baseline profile).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_DIR="${ROOT}/infrastructure/compose"
COMPOSE_FILE="${COMPOSE_DIR}/docker-compose.yml"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Install Docker Desktop, then retry." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker engine is not running." >&2
  exit 1
fi

if [[ ! -f "${COMPOSE_DIR}/.env" ]]; then
  echo "Creating ${COMPOSE_DIR}/.env from .env.example"
  cp "${COMPOSE_DIR}/.env.example" "${COMPOSE_DIR}/.env"
fi

# shellcheck disable=SC1091
source "${COMPOSE_DIR}/.env"
BASELINE_PORT="${BASELINE_HOST_PORT:-3000}"

if lsof -iTCP:"${BASELINE_PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  if ! docker ps --format '{{.Names}}' | grep -qx railflux-baseline; then
    echo "Port ${BASELINE_PORT} is in use by another process (not railflux-baseline)." >&2
    echo "Stop local \`npm run dev\` / dev:stack or set BASELINE_HOST_PORT in infrastructure/compose/.env." >&2
    lsof -iTCP:"${BASELINE_PORT}" -sTCP:LISTEN >&2 || true
    exit 1
  fi
fi

echo "==> Compose baseline profile (MySQL + db-init + API on host :${BASELINE_PORT})"
docker compose -f "${COMPOSE_FILE}" --project-directory "${COMPOSE_DIR}" up -d --build

echo "==> Waiting for baseline readiness"
deadline=$((SECONDS + 120))
until curl -sf "http://127.0.0.1:${BASELINE_PORT}/health/ready" >/dev/null; do
  if (( SECONDS >= deadline )); then
    echo "Timed out waiting for baseline readiness on :${BASELINE_PORT}" >&2
    docker compose -f "${COMPOSE_FILE}" --project-directory "${COMPOSE_DIR}" ps >&2 || true
    exit 1
  fi
  sleep 2
done

HEALTH_OK_MESSAGE="Baseline monolith health ok" \
  BASELINE_HEALTH_URL="http://127.0.0.1:${BASELINE_PORT}" \
  "${ROOT}/scripts/check-baseline-health.sh"
echo ""
"${ROOT}/scripts/compose-status.sh" | tail -n +5 | head -n 20
echo ""
echo "Profile: BASELINE (legacy-style single app — not IRCTC, our experiment monolith)."
echo "Read path ready. Example (mint JWT from repo root):"
echo "  export SYNTHETIC_JWT_SECRET=\${SYNTHETIC_JWT_SECRET:-dev-only-change-me}"
echo "  TOKEN=\$(node scripts/mint-synthetic-jwt.mjs 11111111-1111-4111-8111-111111111111)"
echo "  curl -s -H \"Authorization: Bearer \$TOKEN\" \\"
echo "    \"http://127.0.0.1:${BASELINE_PORT}/v1/search?from=SAB&to=SAA&date=2026-04-01\""
