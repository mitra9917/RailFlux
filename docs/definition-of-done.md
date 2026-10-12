# Definition of Done

## Product

- [ ] Search, displayed availability, booking, status, and confirmation work locally.
- [ ] Baseline and optimized profiles implement the same API contract.
- [ ] Frontend labels displayed availability as advisory.
- [ ] No real personal, payment, or railway data is used.

## Correctness

- [ ] Atomic inventory claim prevents negative inventory.
- [ ] Idempotent retries return one logical result.
- [ ] Timeout-after-commit is reconcilable.
- [ ] Payment failures release/rollback inventory exactly once.
- [ ] Confirmed booking and outbox event are durable together.
- [ ] Duplicate SQS delivery does not duplicate a side effect.
- [ ] Reconciliation SQL passes after every accepted run.

## Architecture

- [ ] Local baseline and optimized Docker profiles run.
- [ ] AWS baseline and optimized CloudFormation profiles deploy sequentially.
- [ ] S3 is private behind CloudFront OAC.
- [ ] ALB origin restriction, security groups, and task roles pass checks.
- [ ] Redis/replica are never authoritative for booking.
- [ ] Teardown removes all session-paid resources.

## Experiment

- [ ] Fixture and request schedules are deterministic and hashed.
- [ ] Open-model generator preflight passes.
- [ ] Calibration freezes load levels and hypotheses.
- [ ] Pair order is randomized and recorded.
- [ ] Principal cells have the planned valid repetitions.
- [ ] Invalid runs remain archived with reasons.
- [ ] Failure tests inject one component fault at a time.

## Evidence

- [ ] Offered, started, completed, dropped, and terminal outcomes are reported.
- [ ] p50/p95/p99 include exact metric and units.
- [ ] Correctness, resource, cache, queue, and cost evidence is linked.
- [ ] Pair-level effects and 95% intervals are reported.
- [ ] No unmeasured improvement is written as a result.
- [ ] No claim implies knowledge of private IRCTC architecture.

## Cost and operations

- [ ] Credit eligibility is checked before provisioning.
- [ ] Budget alerts and anomaly detection are enabled.
- [ ] Every run manifest has estimate, maximum runtime, expiry, and owner.
- [ ] Daily spend is reviewed during AWS testing.
- [ ] Total spend remains below the stop-and-review threshold or has written approval.
- [ ] Final account audit finds no unintended paid resources.

## Documentation

- [ ] README and index link all current documents.
- [ ] Diagrams match service names and flows.
- [ ] API specification validates.
- [ ] ADRs capture material decisions.
- [ ] A second contributor completes a clean reproducibility walkthrough.
