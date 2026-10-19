# Local Compose

## MySQL only (default)

```bash
npm run db:up
```

Host port **3307** → container MySQL **3306**.

## Baseline profile (MySQL + API)

Requires fixture loaded (`npm run db:bootstrap` once while MySQL is up).

```bash
docker compose -f infrastructure/compose/docker-compose.yml --profile baseline up -d --build
./scripts/check-baseline-health.sh
```

## Health probes (ALB / Compose / Kubernetes)

| Probe | Path | Success | Failure |
| --- | --- | --- | --- |
| Liveness | `GET /health/live` | **200** `{ "status": "ok" }` | process down |
| Readiness | `GET /health/ready` | **200** `{ "status": "ok" }` | **503** `{ "status": "fail" }` when MySQL unreachable |

No JWT on health routes. Responses include `Cache-Control: no-store`.
