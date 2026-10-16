# Seeds

Deterministic fixture data is generated from [`experiment/fixtures/manifest.yaml`](../../experiment/fixtures/manifest.yaml) (see `database/scripts/generate-seed-sql.mjs`).

Run:

```bash
./database/scripts/seed.sh
```

Re-running `seed.sh` replaces static fixture rows for the manifest `fixture_id` (idempotent row counts). Use `./database/scripts/reset.sh` between experiment runs to clear bookings and restore inventory.
