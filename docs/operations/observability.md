# Observability and SLO Design

## Correlation model

Every request and background event carries:

- `run_id`
- `request_id`
- W3C `traceparent`
- operation (`search`, `availability`, `booking`, `side_effect`)
- cohort (`legitimate`, `bot_like`)
- architecture (`baseline`, `optimized`)
- hashed idempotency key for booking

Logs are structured JSON and exclude synthetic passenger/payment payloads.

## Primary SLO for experiments

At a given offered booking-start rate:

- p99 terminal booking latency ≤ 2 seconds;
- technical error rate < 1%;
- dropped arrivals < 0.1%;
- zero correctness violations.

Thresholds are provisional until pilot calibration and then frozen before confirmatory runs.

## Metrics

### Demand and outcomes

- offered, started, completed, and dropped iterations;
- confirmed, sold-out, failed, timed-out, and unknown bookings;
- legitimate versus bot-like completion;
- time to sellout.

### Latency

- HTTP p50/p95/p99 by operation/cohort;
- terminal booking p50/p95/p99;
- database transaction and lock-wait latency;
- payment-stub latency;
- queue delay and handler duration;
- scheduled-start delay in k6.

### Resources

- ECS CPU, memory, desired/running/pending tasks, restarts;
- ALB request count, target latency, 4xx/5xx, rejected connections;
- RDS CPU, connections, IOPS, deadlocks, lock waits;
- Redis hit ratio, latency, connections, evictions;
- SQS visible/in-flight messages and oldest-message age.

## Tracing

Use OpenTelemetry application instrumentation. Sample 5–10% generally and 100% for one declared 60-second representative window. Trace the profile-specific path:

```text
baseline:
ALB → monolith → idempotency → inventory transaction
    → payment stub → synchronous outbox handler → confirmation

optimized:
ALB → booking service → idempotency → inventory transaction + outbox → confirmation
outbox publisher → SQS → worker
```

CloudWatch standard metrics may be too coarse for short spikes; one-second application/k6 samples are retained in experiment artifacts.

## Dashboard layout

1. Offered versus completed demand and dropped iterations.
2. Terminal latency and outcome rates by architecture/cohort.
3. ECS and ALB saturation.
4. RDS connection/transaction pressure.
5. Cache hit/miss and replica fallback.
6. Queue depth, age, and worker throughput.
7. Correctness and reconciliation status.
8. Estimated and actual session cost.

## Alarms

- booking technical error > 1% during a test;
- p99 terminal latency over frozen threshold;
- RDS connections > 80% of configured limit;
- queue oldest age over two minutes;
- DLQ depth > 0;
- ECS running tasks below desired;
- daily estimated spend beyond the session plan.

Alarms notify; they do not prove a run valid. The experiment validator decides validity.
