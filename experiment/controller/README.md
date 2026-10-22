# Experiment controller

Single entrypoint for **local** experiment runs (M6 #58): fixture verify, reset/seed, health, k6, correctness, and run record export under `experiment/runs/`.

Design docs and schemas:

- `../protocol.md`, `../test-catalog.md`
- `../run-manifest.template.yaml`, `../result.schema.json`
- `../correctness.sql`

## Command

```bash
export SYNTHETIC_JWT_SECRET='dev-only-change-me'

# Full local run (PT-005 + PT-006 from manifest)
npm run experiment:run -- --manifest experiment/load-pt-local.example.yaml --scenario both

# PT-001 smoke path
npm run experiment:run -- --manifest experiment/load-pt-local.example.yaml --workload pt001

# Plan without side effects
npm run experiment:run -- --manifest experiment/load-pt-local.example.yaml --dry-run
```

See [Experiment runbook](../../docs/runbooks/experiment.md) for protocol context.

**Pair manifests (M6 #59):** `npm run experiment:generate-manifest` — [runbook](../../docs/runbooks/run-manifest-generator.md).

**Result export (M6 #60):** `experiment/runs/<run_id>.result.json` is written automatically by `experiment:run`; re-export with `npm run experiment:export-result`.

AWS deploy remains a separate runbook step.

## Scripts

| File | Role |
| --- | --- |
| `run.sh` | Orchestrates protocol steps 4–14 locally |
| `parse-run-manifest.mjs` | Manifest + `run_id` resolution |
| `write-run-input.mjs` | Assembles finalize input |
| `finalize-run.mjs` | Writes `experiment/runs/<run_id>.json` |
| `export-run-record.mjs` | Run index record builder |

Run outputs: `../runs/*.json` (gitignored except `.gitkeep`).
