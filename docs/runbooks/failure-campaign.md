# Failure test campaign (M7 #65)

Runs **selected failure tests** from [test catalog](../../experiment/test-catalog.md) at approximately **80% calibrated load** (`load_level: failure` → frozen **32 RPS** from PT-002). **One fault at a time**; recovery metrics land in `experiment/result.schema.json` (`recovery.*`, H6).

## Selected tests (budget order)

| ID | Profile | Injection type | Local inject (see below) |
| --- | --- | --- | --- |
| FT-001 | Both | `task_loss` | Stop one API container; allow replacement |
| FT-002 | Optimized | `redis_unavailable` | Pause/block Redis (`docker pause railflux-redis`) |
| FT-003 | Optimized | `worker_paused` | Pause worker container |
| FT-005 | Both | `db_latency_250ms` | Enable app DB delay env (session runbook) |
| FT-007 | Both | `payment_delay_5xx` | Payment stub fault mode (session runbook) |

## Prerequisites

- `experiment/hypotheses.yaml` **`status: frozen`**
- MySQL (`MYSQL_PORT=3307`), k6, stack on `:3000`
- Switch **`npm run compose:baseline`** / **`npm run compose:optimized`** to match each run’s manifest architecture before the controller leg

## Plan only

```bash
npm run experiment:failure-campaign -- --dry-run
```

Default plan: **8 runs** (FT-001/005/007 × both architectures + FT-002/003 optimized).

## Local smoke (~2 min)

```bash
export SYNTHETIC_JWT_SECRET='dev-only-change-me'
export MYSQL_PORT=3307
npm run experiment:failure-campaign:smoke
```

Smoke: **FT-005**, **60s** k6, inject at **20s**, **1 run** (baseline manifest in plan — use matching compose profile).

## Execute a run

1. Start campaign leg (or single manifest via `npm run experiment:run -- --manifest …`).
2. At manifest `failure_injection.offset_seconds` (default **60**), apply **one** fault from the table above.
3. After k6 completes, confirm `experiment/runs/<run_id>.result.json` includes **`recovery`** (`recovery_time_seconds`, `slo_restored`, error rates).

Re-export only:

```bash
npm run experiment:export-result -- --from-run-index experiment/runs/<run_id>.json
```

## Budget reduction

- `--tests FT-005,FT-007` — subset
- `--max-runs 2` — cap sequential runs
- `--duration-seconds 60` — shorter k6 (document as non-confirmatory)

## Invalid runs

Same protocol gates as principal campaign (fixture, correctness, generator preflight). Failed legs stay in `experiment/runs/` with `invalid_reason`; do not use for H6 comparison until re-run.
