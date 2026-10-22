# Experiment result export (M6 #60)

Produces `experiment/runs/<run_id>.result.json` validated against [`experiment/result.schema.json`](../../experiment/result.schema.json).

## Automatic (controller)

`npm run experiment:run` writes the result file during step 13 (alongside the run index).

## Manual re-export

```bash
npm run experiment:export-result -- --from-run-index experiment/runs/run-pt-local-001.json
```

Uses k6 summary paths from the run index, optional MySQL booking counts (`MYSQL_PORT=3307` for Compose), and correctness outcome.

`--skip-db` omits booking aggregation (zeros unless embedded elsewhere).

## Fields

| Source | Schema fields |
| --- | --- |
| Run manifest | `pair_id`, `pair_order`, `architecture`, `request_seed`, `load_level`, `cache_condition`, `cohort_mix` |
| k6 summaries | `demand`, `latencyMs`, `artifacts.k6_raw`, `artifacts.metrics` |
| MySQL | `booking.*` |
| Correctness runner | `correctness_passed`, `valid` / `invalid_reason` |
