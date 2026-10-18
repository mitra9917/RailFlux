# Baseline monolith (`@railflux/baseline`)

Node.js + TypeScript + Express service for the **baseline** profile (single process for read + booking paths in later issues).

## Run locally

**Recommended (Docker MySQL, no local `mysql` CLI required):**

```bash
# from repository root:
cp services/baseline/.env.example services/baseline/.env
npm install
npm run build:shared
npm run db:bootstrap          # Docker MySQL + migrate + fixture
npm run dev -w @railflux/baseline
```

Compose MySQL listens on host **3307** (see `.env.example`). A separate MySQL on **3306** is fine.

Manual DB only: `../../database/scripts/load-fixture.sh` against your own MySQL 8.

On startup, the service loads `services/baseline/.env` (via `dotenv`). Without that file or the `MYSQL_*` keys, you will see `Missing required environment variable: MYSQL_USER`.

Verify:

```bash
curl -s http://127.0.0.1:3000/health/live
curl -s http://127.0.0.1:3000/health/ready
```

`/health/ready` returns **503** until MySQL is reachable and the database exists.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev -w @railflux/baseline` | Hot reload via `tsx` |
| `npm run build -w @railflux/baseline` | Compile to `dist/` |
| `npm run start -w @railflux/baseline` | Run compiled server |

## Synthetic JWT (`syntheticJwt`)

All `/v1/*` routes require `Authorization: Bearer <JWT>` (health routes stay public). Tokens are **local synthetic identities only** — never real IRCTC credentials. Set `SYNTHETIC_JWT_SECRET` in `.env` (see `.env.example`).

Mint a token for manual testing (use a `users.id` UUID from the fixture):

```bash
npm run build:shared
node scripts/mint-synthetic-jwt.mjs 11111111-1111-4111-8111-111111111111
```

OpenAPI v1 handlers (`/v1/search`, etc.) are added in M2 issues #12–#14; the JWT middleware is already enforced on the `/v1` prefix.
