# Database

MySQL 8 schema and experiment data lifecycle.

| Path | Purpose |
| --- | --- |
| `migrations/` | Versioned DDL (core entities from data-consistency design) |
| `seeds/` | Deterministic fixture load aligned with `experiment/fixtures/manifest.yaml` |
| `scripts/` | Migrate, seed, reset helpers used locally and in runbooks |

Post-run checks: `experiment/correctness.sql` (invoked by experiment controller, M3+).
