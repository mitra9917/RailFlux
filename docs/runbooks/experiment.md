# Experiment Runbook

## Before a pair

- Freeze application/image/IaC revisions.
- Generate and record AB/BA order.
- Copy the run-manifest template for both runs.
- Confirm fixture, request seed, payment sequence, load cell, and parity settings.
- Confirm enough budget and time for both runs plus teardown.

## Before each run

1. Restore fixture and verify schema/fixture checksums.
2. Empty bookings, idempotency, outbox, processed events, SQS, and DLQ.
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
