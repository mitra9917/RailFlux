# Principal paired campaign (M7 #64)

Runs the **minimum viable principal campaign** from [protocol](../experiment/protocol.md): four cells × five AB/BA repetitions (20 pairs, 40 measured runs), **sequentially** with isolated reset between legs.

## Prerequisites

- `experiment/hypotheses.yaml` **`status: frozen`** (PT-002 calibration).
- Local stack: MySQL (`MYSQL_PORT=3307`), k6, API on `:3000`.
- **Profile switch:** each pair runs **baseline** then **optimized** (or BA order from seed). Use `npm run compose:baseline` / `npm run compose:optimized` (or AWS deploy) to match the leg architecture before the controller run.

## Plan only

```bash
npm run experiment:principal-campaign -- --dry-run
```

## Budget-reduced local smoke

```bash
npm run experiment:principal-campaign -- \
  --campaign-id principal-smoke-001 \
  --cells C1-L80-legit \
  --max-pairs 1 \
  --reps 1
```

## Full campaign (local)

```bash
export SYNTHETIC_JWT_SECRET='dev-only-change-me'
export MYSQL_PORT=3307
npm run experiment:principal-campaign -- --campaign-id principal-local-001 --reps 5
```

## Outputs

| Artifact | Purpose |
| --- | --- |
| `experiment/campaigns/<campaign_id>.json` | Plan, outcomes, `invalid_archive` summary |
| `experiment/campaigns/<campaign_id>/manifests/*.yaml` | Generated pair manifests |
| `experiment/runs/<run_id>.json` | Per-run index (`valid` / `invalid_reason`) |

Load levels **L80** / **L110** map to frozen `progressive_load_rps` (e.g. 32 / 44 RPS at capacity 40).

## Options

- `--reps N` — repetitions per cell (default 5).
- `--max-pairs N` — stop after N pairs (documented budget reduction).
- `--cells C1-L80-legit,C3-L80-mixed` — subset of cells.
