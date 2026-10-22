# Load tests from run manifest (M6 #57)

PT-005 (70/20/10 search/availability/booking) and PT-006 (contention-heavy booking) use **open-model** k6 executors configured from `experiment.run-manifest.template.yaml` fields:

| Manifest field | Effect |
| --- | --- |
| `experiment.load_level` | Arrival rate: `L80` → 8 iter/s (`L` value ÷ 10, clamped 1–50) |
| `experiment.duration_seconds` | k6 scenario duration |
| `experiment.inventory_profile` | `contention` → default `--scenario both`; else PT-005 only |
| `run_id` | Manifest `run_id`; k6 uses `run_id-PT-005` unless `LOAD_K6_RUN_ID` is set (experiment controller sets it for shared DB namespace) |

## Commands

```bash
export SYNTHETIC_JWT_SECRET='dev-only-change-me'

# Plan only
npm run load:manifest -- --manifest experiment/load-pt-local.example.yaml --dry-run

# Local short run (30s @ 3 RPS) — PT-005 + PT-006
npm run load:manifest -- --manifest experiment/load-pt-local.example.yaml --scenario both

# Overrides
npm run load:manifest -- --manifest experiment/my-run.yaml --scenario pt005 --rate 5 --duration 60s
```

**Before booking-heavy runs:** reset experiment DB state so inventory is not already exhausted:

```bash
npm run db:reset
```

Uses the host `mysql` client when installed; otherwise runs SQL via the Compose `mysql` container (`database/scripts/mysql-cli.sh`). Requires MySQL up (`npm run db:up` or Compose stack running).

## Artifacts

`load-tests/results/PT-005-<run_id>-artifact.json` and `PT-006-...` index k6 summary/raw paths.
