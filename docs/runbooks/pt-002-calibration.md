# PT-002 calibration pilot (M7 #63)

Stepped **open-model** load (70/20/10 search / availability / booking) on the **baseline** profile finds the maximum offered rate that still meets the preregistered primary SLO:

- terminal booking p99 ≤ 2000 ms;
- technical HTTP error rate ≤ 1%;
- dropped iterations ≤ 0.1%;
- k6 generator gates (no saturation).

## Prerequisites

```bash
export SYNTHETIC_JWT_SECRET='dev-only-change-me'
export MYSQL_PORT=3307
npm run compose:baseline   # or edge stack on :3000
```

Generator **host** load must stay below 70% (`npm run load:preflight`). If your laptop is busy, wait until `uptime`’s 1-minute load is below ~`(0.7 × CPU count)`.

Optional local override:

```bash
export GENERATOR_PREFLIGHT_MAX_HOST_LOAD_PCT=85
```

## Dry-run step plan

```bash
npm run load:pt002 -- --dry-run
```

## Full pilot

Default ladder: **5 → 40 RPS** in steps of **5**, **60s** per step (~**1–15 minutes** total). k6 prints live progress; the run stops early when a step fails SLO.

```bash
npm run load:pt002 -- --run-id cal-baseline-001 --start-rate 5 --step-rate 5 --max-rate 40 --step-duration 60s
```

Shorter local trial: `--max-rate 15 --step-duration 30s`.

Artifacts:

- `experiment/calibration/pilots/<run_id>.json` — step outcomes and `slo_capacity_offered_rps`
- `load-tests/results/pt-002-<run_id>-r<RATE>-summary.json` — per-step k6 summaries

## Freeze hypotheses

After a successful pilot (at least one passing step):

```bash
npm run load:pt002 -- --run-id cal-baseline-001 --freeze
```

This sets `status: frozen` and writes the `calibration:` block (capacity plus 50/80/110% derived rates) in `experiment/hypotheses.yaml`.

Confirmatory paired runs (**#64**) must use the frozen rates only.
