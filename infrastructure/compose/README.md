# Local Compose

**Not IRCTC** — this is RailFlux’s own baseline vs optimized experiment. See [docs/local-docker-profiles.md](../../docs/local-docker-profiles.md) for a plain-language map.

Quick check: `npm run compose:status`

Docker Compose runs **MySQL 8** for all profiles. Use **baseline** or **optimized** via `COMPOSE_PROFILES` (see `.env.example` vs `.env.optimized.example`).

## Profile comparison

| | **Baseline** (`compose:baseline`) | **Optimized** (`compose:optimized`) |
| --- | --- | --- |
| **Command** | `npm run compose:baseline` | `npm run compose:optimized` |
| **Env file** | `.env.example` → `.env` | `.env.optimized.example` → `.env` |
| **HTTP entry** | Monolith `@railflux/baseline` | Edge router → read + booking |
| **Host port** | `BASELINE_HOST_PORT` (default **3000**) | `EDGE_HOST_PORT` (default **3000**) |
| **MySQL** | yes (host **3307**) | yes (host **3307**) |
| **Redis** | — | yes (host **6379**) |
| **ElasticMQ** | — | yes (host **9324**) |
| **Services** | `db-init`, `baseline` | `db-init`, `sqs-init`, `read`, `booking`, `worker`, `edge` |

Do not run both profiles on the same host port **3000** at once.

## Baseline quick start

From the repository root:

```bash
npm run compose:baseline
```

Or from this directory (uses `.env` with `COMPOSE_PROFILES=baseline`):

```bash
cp .env.example .env   # first time only
docker compose up -d --build
curl -s http://127.0.0.1:3000/health/ready
```

## Optimized quick start

From the repository root:

```bash
npm run compose:optimized
```

Or from this directory:

```bash
cp .env.optimized.example .env   # first time only
docker compose up -d --build
curl -s http://127.0.0.1:3000/health/ready
```

The edge service waits until read and booking are ready. The worker consumes `railflux-side-effects` on ElasticMQ (queue + DLQ created by `sqs-init`).

Stop either profile:

```bash
docker compose --project-directory infrastructure/compose down
# add -v to drop MySQL volume and re-seed on next up
```

## MySQL only (host dev / `npm run dev:stack`)

```bash
npm run db:up
```

Host port **3307** → container MySQL **3306**. Load fixture on the host with `npm run db:load` when running services with `npm run dev -w …`.

## Services

| Service | Profile | Purpose |
| --- | --- | --- |
| `mysql` | default | MySQL 8, persistent volume `railflux-mysql-data` |
| `db-init` | `baseline`, `optimized` | Verify fixture checksums, migrate, seed (once per `up`) |
| `baseline` | `baseline` | `@railflux/baseline` on host port **3000** |
| `redis` | `optimized` | Redis for read availability cache-aside |
| `elasticmq` | `optimized` | Local SQS for booking outbox + worker |
| `sqs-init` | `optimized` | Create side-effects queue + DLQ redrive |
| `read` | `optimized` | `@railflux/read` (internal **3001**) |
| `booking` | `optimized` | `@railflux/booking` with `OUTBOX_DELIVERY=sqs` (**3002**) |
| `worker` | `optimized` | Side-effects consumer |
| `edge` | `optimized` | Unified `/v1` on host **3000** |

## Environment variables

Set in `infrastructure/compose/.env`. Compose substitutes `${VAR}` in `docker-compose.yml`.

| Variable | Default | Used by |
| --- | --- | --- |
| `COMPOSE_PROFILES` | _(see example files)_ | `baseline` or `optimized` service sets |
| `SYNTHETIC_JWT_SECRET` | `dev-only-change-me` | API services — synthetic JWT on `/v1/*` |
| `BASELINE_HOST_PORT` | `3000` | Baseline profile host mapping |
| `EDGE_HOST_PORT` | `3000` | Optimized edge host mapping |
| `REDIS_HOST_PORT` | `6379` | Optional host Redis (optimized) |
| `ELASTICMQ_HOST_PORT` | `9324` | Optional host SQS endpoint (optimized) |

Inside the Compose network, services use `mysql:3306`, `redis:6379`, and `http://elasticmq:9324` — not host **3307**.

## Health probes

| Probe | Path | Success |
| --- | --- | --- |
| Liveness | `GET /health/live` | **200** `{ "status": "ok" }` |
| Readiness | `GET /health/ready` | **200** when dependencies OK; edge checks read + booking upstreams |

No JWT on health routes.

## Port conflicts

- **3000** — baseline monolith or optimized edge; stop the other profile or change `BASELINE_HOST_PORT` / `EDGE_HOST_PORT`.
- **3307** — host MySQL only; containers use `mysql:3306`.

## Related npm scripts

| Script | Behavior |
| --- | --- |
| `npm run compose:baseline` | `scripts/compose-baseline-up.sh` — baseline profile + readiness wait |
| `npm run compose:optimized` | `scripts/compose-optimized-up.sh` — optimized profile + edge readiness |
| `npm run health:check` | Live + ready against `BASELINE_HEALTH_URL` (default `http://127.0.0.1:3000`) |
| `npm run db:bootstrap` | Host path: MySQL container + migrate/seed via `mysql-cli.sh` |
