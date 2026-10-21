#!/usr/bin/env bash
# Show which RailFlux Compose profile is active and what is listening where.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_DIR="${ROOT}/infrastructure/compose"
ENV_FILE="${COMPOSE_DIR}/.env"

echo "RailFlux local Docker — what am I running?"
echo ""
echo "This repo is NOT a copy of IRCTC. It is our experiment:"
echo "  • Baseline  = legacy-style ONE app (monolith) + MySQL"
echo "  • Optimized = cloud-style SPLIT apps + MySQL + Redis + queue + worker"
echo "You run ONE profile at a time for local dev."
echo ""

configured_profile="(unknown)"
if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  configured_profile="$(grep -E '^COMPOSE_PROFILES=' "${ENV_FILE}" | cut -d= -f2- | tr -d '\r' || true)"
  [[ -n "${configured_profile}" ]] || configured_profile="(unset in .env)"
else
  configured_profile="(no infrastructure/compose/.env — copy .env.example or .env.optimized.example)"
fi
echo "Configured in infrastructure/compose/.env: COMPOSE_PROFILES=${configured_profile}"
echo ""

baseline_up=false
edge_up=false
if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx railflux-baseline; then
  baseline_up=true
fi
if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx railflux-edge; then
  edge_up=true
fi

if [[ "${baseline_up}" == true && "${edge_up}" == true ]]; then
  echo "⚠  BOTH baseline and edge containers are running — pick one profile and stop the other."
elif [[ "${edge_up}" == true ]]; then
  echo "▶ Active stack: OPTIMIZED (split services). Use http://127.0.0.1:3000 — edge router."
elif [[ "${baseline_up}" == true ]]; then
  echo "▶ Active stack: BASELINE (monolith). Use http://127.0.0.1:3000 — single API."
else
  echo "▶ No RailFlux API container running (railflux-baseline / railflux-edge)."
fi
echo ""

printf "%-22s %-8s %-40s %s\n" "CONTAINER" "HOST?" "PORTS (host→container)" "PURPOSE"
printf "%-22s %-8s %-40s %s\n" "----------------------" "--------" "----------------------------------------" "------------------------------"

print_row() {
  local name="$1" host="$2" ports="$3" purpose="$4"
  printf "%-22s %-8s %-40s %s\n" "${name}" "${host}" "${ports}" "${purpose}"
}

while IFS= read -r line; do
  [[ -z "${line}" ]] && continue
  name="${line%%|*}"
  rest="${line#*|}"
  ports="${rest%%|*}"
  status="${rest##*|}"
  host="internal"
  purpose="—"
  case "${name}" in
    railflux-baseline)
      purpose="Baseline monolith API (search, book, pay in one process)"
      host="YES :3000"
      ;;
    railflux-edge)
      purpose="Optimized entry — routes /v1 to read + booking"
      host="YES :3000"
      ;;
    railflux-read)
      purpose="Optimized — search + availability (+ Redis cache)"
      ;;
    railflux-booking)
      purpose="Optimized — POST /v1/bookings + outbox→SQS"
      ;;
    railflux-worker)
      purpose="Optimized — async side effects from queue"
      ;;
    railflux-mysql)
      purpose="Database (both profiles)"
      host="YES :3307"
      ;;
    railflux-redis)
      purpose="Optimized — availability cache only"
      host="YES :6379"
      ;;
    railflux-elasticmq)
      purpose="Optimized — local SQS (booking outbox → worker)"
      host="YES :9324"
      ;;
    railflux-db-init)
      purpose="One-shot fixture load (exits when done)"
      ;;
    railflux-sqs-init)
      purpose="One-shot queue+DLQ setup (exits when done)"
      ;;
  esac
  print_row "${name}" "${host}" "${ports:-—}" "${purpose} (${status})"
done < <(docker ps -a --filter 'name=railflux' --format '{{.Names}}|{{.Ports}}|{{.Status}}' 2>/dev/null | sort)

echo ""
echo "Commands:"
echo "  npm run compose:baseline   — start BASELINE monolith"
echo "  npm run compose:optimized  — start OPTIMIZED split stack"
echo "  npm run compose:status     — this summary"
echo "  docker compose --project-directory infrastructure/compose down"
echo ""
echo "Switching profiles: stop the old API first (baseline OR edge). Do not run standalone"
echo "  docker run railflux-elasticmq / railflux-redis while compose:optimized is in use."
