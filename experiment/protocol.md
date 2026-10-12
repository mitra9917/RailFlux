# RailFlux Experiment Protocol

## Study design

The principal experiment is a randomized, sequential, paired comparison.

Each pair uses:

- the same application/database version;
- the same fixture checksum and request seed;
- identical API semantics and payment-stub sequence;
- one baseline and one optimized run;
- randomized order (`AB` or `BA`);
- isolated database/cache/queue state;
- the same load-generator configuration.

Simultaneous mirroring is prohibited for principal booking tests.

## Minimum viable principal campaign

The budgeted AWS principal campaign has four cells:

- offered load: 80% and 110% of pilot baseline SLO capacity;
- cohort mix: legitimate-only and 80/20 legitimate/bot-like;
- inventory: contention;
- architecture bundle: baseline with no application cache versus optimized with verified warm cache;
- repetitions: five paired AB/BA repetitions per cell.

This is 20 pairs/40 measured runs. Runs are three minutes plus reset/export time and are grouped into short-lived deployment sessions.

The following are secondary: 50% load, 50/50 cohort mix, non-contention inventory, soak, and full cold/warm cache analysis. H5 is an optimized-only repeated comparison of cold versus warm cache and is not analyzed as a baseline/optimized pair. Secondary cells run locally first and move to AWS only if budget remains.

For principal legitimate-only cells WAF is off for both profiles. For principal mixed-cohort cells the same frozen WAF rules are on for both profiles. WAF mode is part of the run manifest.

## Run order

1. Freeze code/image/IaC versions.
2. Generate pair order from the recorded randomization seed.
3. Deploy the selected profile.
4. Restore the fixture and verify its checksum.
5. Clear idempotency, queue, worker, payment-stub, and metrics state.
6. Apply cache condition:
   - cold: flush cache only; services and DB remain healthy;
   - warm: execute fixed read-only prewarm and verify key count/hit path.
7. Return capacity to the run manifest’s fixed values. Principal paired cells use fixed capacity; only declared elasticity runs enable the manifest’s autoscaling policy.
8. Pass health, cost/expiry, and generator preflight gates.
9. Start a unique `run_id` telemetry namespace.
10. Execute workload.
11. Stop writes, wait for bounded terminal reconciliation, and preserve state.
12. Run correctness SQL.
13. Export k6, application, AWS, trace, cost, and reconciliation artifacts.
14. Mark run valid or invalid using preregistered rules.
15. Tear down or reset before its pair.

## Calibration

Pilot tests determine baseline SLO capacity using stepped open arrivals. Calibration ends before confirmatory data collection. Frozen rates and thresholds are recorded in `hypotheses.yaml`.

The load generator must remain below 70% CPU, have adequate network capacity, and report acceptable scheduled-start delay. Generator-limited runs are invalid.

## Primary endpoint

Maximum offered booking-start rate satisfying:

- p99 terminal booking latency ≤ 2 seconds;
- technical error rate < 1%;
- dropped arrivals < 0.1%;
- every correctness invariant passes.

## Secondary endpoints

- HTTP and terminal p50/p95/p99 latency;
- offered, started, completed, confirmed, sold-out, failed, timeout, and dropped counts;
- legitimate-user success under bot-like pressure;
- RDS CPU/connections/lock waits;
- cache hit ratio and replica load;
- queue depth, age, throughput, and recovery;
- recovery time after failure;
- confirmed bookings and SLO-compliant requests per dollar.

## Resource and cost parity

Report both:

1. **Resource parity:** same maximum application vCPU/memory and database class; optimized auxiliary resources are explicit.
2. **Cost parity:** maximum hourly stack cost within ±5%, adjusted through compute caps, with all managed services included.

Application parity uses the sum of maximum vCPU and memory across all request-serving tasks. Worker capacity and managed cache/replica resources are itemized separately and included in cost parity. Do not call a comparison fair merely because individual ECS task sizes match.

## Statistics

The unit of analysis is one complete run.

- Calculate each run-level metric.
- For matched pairs, calculate `log(optimized / baseline)`.
- Report median/geometric ratio and paired bootstrap 95% confidence interval.
- Plot every repetition; do not pool requests as independent samples.
- Report effect sizes even when a hypothesis is not met.
- Apply Holm correction to families of secondary hypothesis tests.

## Invalid-run rules

Invalidate before viewing comparative outcomes if:

- fixture/checksum or reset gate fails;
- any correctness invariant fails;
- generator saturation or excessive start delay occurs;
- unplanned deployment/configuration drift appears;
- required telemetry is missing;
- another experiment overlaps the stack;
- a non-prespecified external service incident dominates the run.

Retain invalid artifacts and reason; never silently delete them.

## Protocol amendments

After confirmatory runs begin, changes to factors, thresholds, exclusions, or analysis create a dated amendment. Earlier runs are not relabeled post hoc.
