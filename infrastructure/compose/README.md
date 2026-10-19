# Local Compose

Docker Compose runs **MySQL 8** and, with the **baseline** profile, the **baseline monolith** with a one-shot **fixture load** so search/availability work without manual `db:bootstrap` on the host.

## Quick start (full read path)

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

Stop:

```bash
docker compose --project-directory infrastructure/compose down
# add -v to drop MySQL volume and re-seed on next up
```

## MySQL only (host dev / `npm run dev:stack`)

```bash
npm run db:up
```

Host port **3307** → container MySQL **3306**. Load fixture on the host with `npm run db:load` when using `npm run dev -w @railflux/baseline`.

## Services

| Service | Profile | Purpose |
| --- | --- | --- |
| `mysql` | default | MySQL 8, persistent volume `railflux-mysql-data` |
| `db-init` | `baseline` | Verify fixture checksums, migrate, seed (runs once per `up`) |
| `baseline` | `baseline` | `@railflux/baseline` on host port **3000** (configurable) |

## Environment variables

Set in `infrastructure/compose/.env` (see `.env.example`). Compose substitutes `${VAR}` in `docker-compose.yml`.

| Variable | Default | Used by |
| --- | --- | --- |
| `COMPOSE_PROFILES` | _(unset)_ | Compose — set to `baseline` so plain `docker compose up` includes API + db-init |
| `SYNTHETIC_JWT_SECRET` | `dev-only-change-me` | `baseline` — signs/verifies synthetic JWT on `/v1/*` |
| `BASELINE_HOST_PORT` | `3000` | Host port mapped to baseline **3000** |

Baseline container MySQL settings are fixed in compose (`MYSQL_HOST=mysql`, port **3306** inside the network). Do not point the container at host **3307**.

## Health probes (ALB / Compose / Kubernetes)

| Probe | Path | Success | Failure |
| --- | --- | --- | --- |
| Liveness | `GET /health/live` | **200** `{ "status": "ok" }` | process down |
| Readiness | `GET /health/ready` | **200** `{ "status": "ok" }` | **503** `{ "status": "fail" }` when MySQL unreachable |

No JWT on health routes. Responses include `Cache-Control: no-store`.

## Port conflicts

- **3000** — stop `npm run dev` / `dev:stack` before `compose:baseline`, or set `BASELINE_HOST_PORT` in `.env`.
- **3307** — only the host-published MySQL port; baseline in Compose does not bind it.

## Related npm scripts

| Script | Behavior |
| --- | --- |
| `npm run compose:baseline` | `scripts/compose-baseline-up.sh` — up, wait for ready, print curl hint |
| `npm run health:check` | Hits `http://127.0.0.1:3000` live + ready (override with `BASELINE_HEALTH_URL`) |
| `npm run db:bootstrap` | Host path: MySQL container + migrate/seed via `mysql-cli.sh` |
