# Paired bootstrap analysis (M7 #66)

Implements [protocol §Statistics](../../experiment/protocol.md): run-level metrics, `log(optimized/baseline)` per matched pair, **geometric mean ratio** with **paired bootstrap 95% CI**, and **Holm** correction for secondary hypotheses (`experiment/hypotheses.yaml`).

## Inputs

- Campaign inventory JSON (e.g. `experiment/campaigns/principal-local-001.json` from `npm run experiment:principal-campaign`)
- Valid **`experiment/runs/<run_id>.result.json`** for both legs of each pair

## Run

```bash
npm run experiment:analyze-pairs -- \
  --campaign experiment/campaigns/principal-local-001.json
```

Options:

- `--runs experiment/runs` — result directory (default)
- `--out experiment/analysis/output/my-analysis.json`
- `--load-level L80` — restrict to one cell load level
- `--cell C1-L80-legit` — restrict to one principal cell
- `--dry-run` — print JSON report, do not write file

## Output

JSON report includes:

- `metrics[]` per hypothesis with `pairs`, `log_ratio_mean`, `geometric_mean_ratio`, `ci_95_log`, `ci_95_ratio`, bootstrap `p_value` where defined
- `holm_secondary[]` — step-down adjusted secondary tests
- `correctness.H3_oversell_and_duplicate_zero` — all valid pairs pass oversell/duplicate gates

H5 (cold vs warm) and non-paired designs are marked `skipped` until dedicated cells exist.

## Protocol alignment

| Protocol rule | Implementation |
| --- | --- |
| Unit = complete run | Metrics from each `result.schema.json` |
| `log(optimized/baseline)` | `pairedLogRatios` |
| Median/geometric ratio + paired bootstrap 95% CI | `pairedBootstrapMeanLogRatio` |
| Holm for secondaries | `holmAdjust` on non-primary hypotheses with p-values |

Primary **H1** uses one-sided bootstrap vs `minimum_effect_ratio: 1.25`. **H2** uses upper bound vs `maximum_effect_ratio: 0.75` on latency.
