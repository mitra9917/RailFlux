# Load tests

[k6](https://k6.io/) open-model workloads and supporting data (M6).

| Path | Purpose |
| --- | --- |
| `k6/` | Scripts for PT-* scenarios in the test catalog |
| `k6/pt-001-smoke.js` | **PT-001** smoke (1–5 RPS health + search) |
| `scripts/run-pt001-smoke.sh` | Preflight health, mint JWT, run k6, export artifacts |
| `data/` | Request schedules and cohort fixtures referenced by k6 |
| `results/` | Exported run artifacts (gitignored except `.gitkeep`) |

## PT-001 smoke (M6 #56)

```bash
npm run load:pt001 -- --run-id run-pt001-001 --rate 3
```

See [docs/runbooks/pt-001-smoke.md](../docs/runbooks/pt-001-smoke.md).
