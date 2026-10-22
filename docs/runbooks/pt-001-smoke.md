# PT-001 smoke workload (M6 #56)

Open-model **1–5 RPS** mix of `/health/live`, `/health/ready`, and authenticated `GET /v1/search` to validate k6 scripts and `X-Run-Id` telemetry hooks before heavier PT-* runs.

## Prerequisites

- [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) installed.
- Stack running with fixture loaded (`npm run db:bootstrap` or experiment reset).
- **Baseline:** `npm run compose:baseline` (API on `:3000`).
- **Optimized:** `npm run compose:optimized` (edge on `:3000`).

## Documented command

```bash
export SYNTHETIC_JWT_SECRET='dev-only-change-me'   # match Compose / service env

npm run load:pt001 -- --run-id run-pt001-smoke-001 --rate 3 --duration 30s
```

Optional edge URL:

```bash
npm run load:pt001 -- --base-url http://127.0.0.1:3000 --rate 5
```

## Exported artifacts

Under `load-tests/results/` (gitignored):

| File | Purpose |
| --- | --- |
| `pt-001-<run_id>-summary.json` | k6 end-of-test summary |
| `pt-001-<run_id>-raw.ndjson` | k6 JSON time series |
| `pt-001-<run_id>-artifact.json` | Index linking paths + `run_id` for `result.schema.json` export (M6 P4) |

## Acceptance

- Thresholds: `http_req_failed < 5%`, checks `> 95%`.
- Search uses pinned TC-001 route (`SAB` → `SAA`, `2026-04-01`) from the deterministic fixture.
