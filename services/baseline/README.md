# Baseline monolith (`@railflux/baseline`)

Node.js + TypeScript + Express service for the **baseline** profile (single process for read + booking paths in later issues).

## Run locally

**Daily dev (one terminal):**

```bash
# from repository root (first time only: npm install && npm run db:bootstrap)
npm run dev:stack
```

Starts Docker **MySQL** on **3307**, then the baseline API on **3000**. Ctrl+C stops the API only; MySQL stays up.

**First-time DB setup:**

```bash
cp services/baseline/.env.example services/baseline/.env
npm install
npm run db:bootstrap
```

Compose MySQL listens on host **3307** (see `.env.example`). A separate MySQL on **3306** is fine.

Manual DB only: `../../database/scripts/load-fixture.sh` against your own MySQL 8.

On startup, the service loads `services/baseline/.env` (via `dotenv`). Without that file or the `MYSQL_*` keys, you will see `Missing required environment variable: MYSQL_USER`.

Verify (no JWT):

```bash
curl -s http://127.0.0.1:3000/health/live
curl -s http://127.0.0.1:3000/health/ready
npm run health:check
```

**TC-001 integration** (catalog search/availability against MySQL + this app):

```bash
export MYSQL_PORT=3307   # if using compose/dev-stack MySQL
export SYNTHETIC_JWT_SECRET=dev-only-change-me
npm run test:tc001
```

TC-001 lives under `tests/integration/` and is **not** part of default `npm test` (no MySQL in the lint job).

| Probe | Meaning |
| --- | --- |
| `/health/live` | Process up → always **200** `ok` |
| `/health/ready` | MySQL reachable → **200** `ok`; else **503** `fail` |

Compose / ALB: see [infrastructure/compose/README.md](../../infrastructure/compose/README.md).

## Structured logs

Each HTTP request logs one JSON line (`event: http_request`) with `request_id`, optional `run_id` from header `X-Run-Id`, and `operation`. See [observability.md](../../docs/operations/observability.md).

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

### Search (`GET /v1/search`)

Requires JWT. Query params: `from`, `to`, `date` (ISO `YYYY-MM-DD`). Fixture journey date is **`2026-04-01`**; pick `from`/`to` from the `trains` table in TablePlus.

```bash
TOKEN="$(node scripts/mint-synthetic-jwt.mjs <users.id-uuid>)"
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:3000/v1/search?from=SAB&to=SAA&date=2026-04-01"
```

Response includes `items` (train runs) and advisory `freshness` (`authoritative: false`, `cacheStatus: BYPASS` on baseline).

### Availability (`GET /v1/availability`)

Requires JWT. Query: `trainRunId` (UUID from search), `class` (`SL` | `3A` | `2A`), `quota` (`TATKAL`).

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:3000/v1/availability?trainRunId=<trainRunId>&class=3A&quota=TATKAL"
```

Returns `displayedSeats` from `seat_inventory` plus advisory `freshness` (`cacheStatus: BYPASS` on baseline). Unknown run/bucket → **404** `NOT_FOUND`.

### Idempotency (POST /v1/bookings, M3)

Requires header **`Idempotency-Key`** (16–128 chars).

| Case | HTTP |
| --- | --- |
| Same key + same body (terminal stored) | **200** replay (TC-005) |
| Same key + different body | **409** `IDEMPOTENCY_CONFLICT` (TC-006) |
| Same key + same body (still processing) | **425** `BookingInProgress` |
| New booking (no idempotency row) | **501** until full create path lands |

Integration: `npm run test:idempotency-replay`, `npm run test:idempotency-conflict`.

### Payment stub (M3)

Deterministic authorize outcomes from `experiment/fixtures/manifest.yaml` (`payment_sequence`, `payment_stub.*`). Use `derivePaymentStubOutcome` / `authorizePayment` in `@railflux/shared` and `services/baseline/src/services/payment-stub.ts`. Call `resetPaymentStubRun()` on experiment reset. Never log `paymentToken`.

### Inventory claim (booking path, M3)

`claimInventorySeats` in `src/services/claim-inventory.ts` performs a single-row optimistic `UPDATE` (`version` + `available_seats`). Zero rows updated → `SOLD_OUT`, `VERSION_CONFLICT`, or `NOT_FOUND`. Integration tests: `npm run test:claim-inventory` (MySQL + fixture).

### Payment failure release (M3)

When authorization fails, `finalizeBookingAfterPaymentFailure` in `src/services/payment-failure-release.ts` moves the booking to terminal `FAILED`, marks the payment `FAILED`, and calls `releaseInventorySeats` once (optimistic version; stale retry → no double release). Integration: `npm run test:payment-failure` (TC-008).

Booking routes: M2 #14+.
