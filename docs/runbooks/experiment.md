# Experiment Runbook

## Single entrypoint (local)

The experiment controller runs protocol steps **4–14** for local stacks (fixture verify → reset → health → k6 → correctness → export):

```bash
export SYNTHETIC_JWT_SECRET='dev-only-change-me'
# Compose MySQL is on host port 3307 (defaults in database/scripts/common-env.sh).
export MYSQL_PORT=3307

npm run experiment:run -- --manifest experiment/load-pt-local.example.yaml --scenario both
```

Options: `--workload pt001|manifest`, `--dry-run`, `--skip-reset`, `--skip-load`, `--skip-correctness`, `--base-url`.

Outputs per run:

- `experiment/runs/<run_id>.json` — run index (protocol steps, k6 links, correctness)
- `experiment/runs/<run_id>.result.json` — **`result.schema.json`** document (k6 demand/latency, DB booking counts, artifact paths)

Re-export result only: `npm run experiment:export-result -- --from-run-index experiment/runs/<run_id>.json`

**Pair randomization (step 2):** [run manifest generator](./run-manifest-generator.md) — `npm run experiment:generate-manifest`.

Deploy (step 3) and teardown (step 15) remain manual/AWS runbooks.

## Before a pair

- Freeze application/image/IaC revisions.
- Generate and record AB/BA order.
- Copy the run-manifest template for both runs.
- Confirm fixture, request seed, payment sequence, load cell, and parity settings.
- Confirm enough budget and time for both runs plus teardown.

## Before each run

1. Restore fixture and verify schema/fixture checksums (`node database/scripts/verify-fixture.mjs`; copy JSON `fixture_sha256` into the run manifest `fixture.sha256` field).
2. Empty bookings, idempotency, outbox, processed events, SQS, and DLQ.
   - **Local MySQL:** `./database/scripts/reset.sh` (restores `seat_inventory` for the manifest `fixture_id`).
   - **Initial or full fixture rebuild:** `./database/scripts/seed.sh` (runs migrations, then deterministic seed from `experiment/fixtures/manifest.yaml`).
3. Apply cold/warm cache procedure.
4. Set fixed capacity or declared autoscaling policy.
5. Verify health and dependency readiness.
6. Verify generator CPU/network/time and preallocated VUs.
7. Start unique `run_id` telemetry.

## Execute

1. Start capture.
2. Run background/pre-release phase.
3. Release burst at scheduled time.
4. Run peak and decay phases without manual tuning.
5. Record planned failure injection timestamp if applicable.
6. Stop new traffic after prescribed duration.
7. Wait only the bounded reconciliation interval.

## After each run

1. Preserve database state.
2. Resolve timed-out/unknown client outcomes through status and DB records.
3. Run `correctness.sql`.
4. Export k6 summary/raw output, application metrics/logs, AWS metrics, sampled traces, queue state, and cost estimate.
5. Validate against `result.schema.json`.
6. Mark valid/invalid before comparing to its pair.
7. Reset or destroy the profile.

## After the pair

- Confirm both runs used identical cell settings.
- Calculate paired metrics only if both are valid.
- If one is invalid, rerun the complete pair unless the protocol predefines otherwise.
- Update campaign inventory and remaining cost allowance.

## Prohibited during a measured run

- manual scaling or cache warming;
- changing WAF/rate rules;
- changing fixture or payment outcomes;
- starting another experiment;
- discarding dropped iterations;
- stopping early because results look unfavorable.
