# Load tests

[k6](https://k6.io/) open-model workloads and supporting data (M6).

| Path | Purpose |
| --- | --- |
| `k6/` | Scripts for PT-* scenarios in the test catalog |
| `k6/pt-001-smoke.js` | **PT-001** smoke (1–5 RPS health + search) |
| `k6/pt-002-calibration-step.js` | **PT-002** one calibration step (70/20/10 at fixed RPS) |
| `scripts/run-pt001-smoke.sh` | Preflight health, mint JWT, run k6, export artifacts |
| `scripts/run-pt002-calibration.sh` | Stepped PT-002 pilot + optional `--freeze` for `hypotheses.yaml` |
| `data/` | Request schedules and cohort fixtures referenced by k6 |
| `results/` | Exported run artifacts (gitignored except `.gitkeep`) |

## PT-001 smoke (M6 #56)

```bash
npm run load:pt001 -- --run-id run-pt001-001 --rate 3
```

See [docs/runbooks/pt-001-smoke.md](../docs/runbooks/pt-001-smoke.md).

## PT-005 / PT-006 from run manifest (M6 #57)

```bash
npm run load:manifest -- --manifest experiment/load-pt-local.example.yaml --scenario both
```

`load_level` (e.g. `L30` → 3 RPS) and `duration_seconds` come from the manifest. See [docs/runbooks/load-from-manifest.md](../docs/runbooks/load-from-manifest.md).
