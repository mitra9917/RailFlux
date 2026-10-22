# Run manifest generator (M6 #59)

Generates **two** run manifests per principal pair (baseline + optimized) with **AB/BA order** derived from a recorded randomization seed. Output matches `experiment/run-manifest.template.yaml`.

## Pair order

| `randomization_seed` (even) | `pair_order` | Execution order |
| --- | --- | --- |
| even (e.g. 772910) | AB | baseline → optimized |
| odd (e.g. 772911) | BA | optimized → baseline |

Both runs share `pair_id`, `pair_order`, `fixture.request_seed`, WAF mode, cache condition, and load cell fields; each file has a distinct `run_id` and `architecture`.

## Commands

```bash
# Plan (JSON on stdout)
npm run experiment:generate-manifest -- \
  --pair-id pair-001 \
  --randomization-seed 772910 \
  --session-name lab-oct22 \
  --waf-mode off \
  --cache-condition none

# Write YAML files
npm run experiment:generate-manifest -- \
  --pair-id pair-001 \
  --randomization-seed 772910 \
  --session-name lab-oct22 \
  --waf-mode on \
  --cache-condition warm \
  --load-level L80 \
  --output-dir experiment/generated

# Fill git SHAs from HEAD
npm run experiment:generate-manifest -- \
  --pair-id pair-001 \
  --randomization-seed 772910 \
  --session-name lab-oct22 \
  --fill-git-shas \
  --output-dir experiment/generated
```

Mixed-cohort principal cells: use `--waf-mode on` for both profiles (protocol). Legitimate-only cells: `--waf-mode off`.

After generation, run each manifest with [experiment controller](./experiment.md) or AWS deploy runbooks. Copy verified `fixture.sha256` from `npm run verify:fixture` before paid runs.
