# Load generator preflight (M6 #61)

Protocol step 8: the generator must not be saturated before or during a measured run. Runs fail preflight when:

| Gate | Limit | When |
| --- | --- | --- |
| Host CPU load | 1-min load average **&lt; 70%** of CPU count | Before k6 |
| Network | `GET /health/live` succeeds within 5s | Before k6 |
| Dropped iterations | Rate **≤ 0.1%** | After k6 (summary) |
| Connection blocked p95 | **≤ 750 ms** | After k6 |
| Start delay | `iteration_duration.max − med` **≤ 2 s** | After k6 |

## Commands

```bash
# Host + network only (before load)
npm run load:preflight -- --base-url http://127.0.0.1:3000

# Post-run check on a k6 summary export
node load-tests/scripts/generator-preflight.mjs k6-summary load-tests/results/PT-005-run-001-summary.json
```

`npm run load:pt001`, `npm run load:manifest`, and `npm run experiment:run` invoke these gates automatically. Failed post-run checks exit non-zero and mark the experiment run **invalid** (`generator_preflight_failed`).
