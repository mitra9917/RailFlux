# Database

MySQL 8 schema and experiment data lifecycle.

| Path | Purpose |
| --- | --- |
| `migrations/` | Versioned DDL (core entities from data-consistency design) |
| `seeds/` | Deterministic fixture load aligned with `experiment/fixtures/manifest.yaml` |
| `scripts/` | Migrate, seed, reset helpers used locally and in runbooks |

Post-run checks: `experiment/correctness.sql` via `npm run run:correctness -- --run-id <run-id>` (or `./database/scripts/run-correctness.sh --run-id <run-id>`). Exits **0** when all invariants pass, **1** when any check returns violations (JSON on stdout).

## Migrations

Requires MySQL 8 (local or Docker). Host `mysql` CLI is optional if Docker Compose MySQL is running (`npm run db:up`).

```bash
npm run db:bootstrap   # preferred: Compose MySQL + migrate + seed
```

Or manually:

```bash
cp database/.env.example database/.env   # optional; or export vars
export $(grep -v '^#' database/.env | xargs) 2>/dev/null || true
./database/scripts/migrate.sh
```

Initial migration: `migrations/001_core_schema.sql` (users, trains, inventory, bookings, idempotency, outbox, processed_events).

## Seed and reset

```bash
./database/scripts/load-fixture.sh   # verify checksums, migrate, seed (preferred entrypoint)
./database/scripts/verify-fixture.mjs # checksum only; exits non-zero if invalid
./database/scripts/seed.sh             # verify + migrate + seed
./database/scripts/reset.sh            # clear bookings/payments/idempotency/outbox; restore seats
```

After changing migrations or `generate-seed-sql.mjs`, refresh pinned checksums:

```bash
node database/scripts/update-manifest-checksums.mjs
```

**Idempotent workflow:** `seed.sh` → experiment run → `reset.sh` → next run (same fixture data; inventory restored). Re-run `seed.sh` to rebuild static fixture rows from the manifest.

Queue/DLQ depth is not stored in MySQL; reset those via the experiment controller when ElasticMQ/SQS is wired (M4/M6).
