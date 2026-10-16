# Database

MySQL 8 schema and experiment data lifecycle.

| Path | Purpose |
| --- | --- |
| `migrations/` | Versioned DDL (core entities from data-consistency design) |
| `seeds/` | Deterministic fixture load aligned with `experiment/fixtures/manifest.yaml` |
| `scripts/` | Migrate, seed, reset helpers used locally and in runbooks |

Post-run checks: `experiment/correctness.sql` (invoked by experiment controller, M3+).

## Migrations

Requires MySQL 8 client (`mysql`) and a running server.

```bash
cp database/.env.example database/.env   # optional; or export vars
export $(grep -v '^#' database/.env | xargs) 2>/dev/null || true
./database/scripts/migrate.sh
```

Initial migration: `migrations/001_core_schema.sql` (users, trains, inventory, bookings, idempotency, outbox, processed_events).
