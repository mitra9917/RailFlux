# Requirements Traceability

## Correctness

- **Requirement:** no oversell or duplicate charge.
- **Design:** primary atomic claim, unique idempotency, payment constraint.
- **Tests:** TC-003–TC-009.
- **Metrics/evidence:** reconciliation SQL, confirmed seats, oversells, duplicate charges.
- **Acceptance:** zero violations; otherwise run invalid.

## Peak-load performance

- **Requirement:** sustain synchronized arrivals with bounded tail latency.
- **Design:** split services, cache, independent scaling, bounded retries.
- **Tests:** PT-002–PT-006 and PT-011.
- **Metrics:** offered/started/completed/dropped, terminal p99, technical errors.
- **Acceptance:** frozen SLO in `hypotheses.yaml`.

## Read offload

- **Requirement:** reduce authoritative database read pressure.
- **Design:** cache-aside Redis and read replica.
- **Tests:** TC-002, PT-008, FT-002, FT-009.
- **Metrics:** cache hit ratio, replica queries, primary CPU/connections, read latency.
- **Acceptance:** H5 effect with unchanged correctness.

## Asynchronous resilience

- **Requirement:** non-critical side effects must not extend optimized booking latency or be lost.
- **Design:** transactional outbox, SQS/DLQ, idempotent worker.
- **Tests:** TC-010, FT-003, FT-004.
- **Metrics:** queue depth/age, outbox gaps, duplicate handlers, drain time.
- **Acceptance:** committed bookings unaffected; eventual processing or declared DLQ.

## Abuse resistance

- **Requirement:** reduce bot-like backend pressure without harming legitimate users.
- **Design:** cell-controlled WAF/rate rules and cohort-aware admission.
- **Tests:** PT-009, ST-001–ST-003.
- **Metrics:** allowed/blocked rate, legitimate completion, false positives.
- **Acceptance:** H4 thresholds.

## Security

- **Requirement:** least privilege and private data services.
- **Design:** task-specific IAM, SG matrix, private RDS/Redis, OAC, secret handling.
- **Tests:** ST-004–ST-006.
- **Evidence:** IAM negative tests, network reachability, log scan.
- **Acceptance:** no direct origin/data access or sensitive logging.

## Observability

- **Requirement:** explain performance and recovery by request/run.
- **Design:** structured logs, OpenTelemetry, common tags, CloudWatch.
- **Tests:** every accepted experiment run.
- **Metrics:** complete client/server/resource/trace artifacts.
- **Acceptance:** missing mandatory telemetry invalidates the run.

## Cost

- **Requirement:** preserve most of the $200 credit allocation.
- **Design:** local-first, ephemeral profiles, no NAT/API Gateway/Multi-AZ.
- **Tests:** deployment/teardown smoke and cost audit.
- **Metrics:** estimated hourly and actual run cost, orphan inventory.
- **Acceptance:** $40–$70 target; stop/review at $100; no unintended paid orphan.

## Reproducibility

- **Requirement:** another contributor can recreate a run.
- **Design:** fixture checksums, seeds, immutable versions, run manifests, AB/BA order.
- **Tests:** clean-state walkthrough.
- **Evidence:** manifest, artifact links, protocol and runbook.
- **Acceptance:** second contributor reproduces setup and obtains a valid smoke run.
