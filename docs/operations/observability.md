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

### Baseline HTTP request log (`http_request`)

Emitted once per HTTP response (stdout JSON line):

| Field | Required | Description |
| --- | --- | --- |
| `event` | yes | Always `http_request` |
| `architecture` | yes | `baseline` for the monolith |
| `request_id` | yes | Server-generated UUID; echoed as response header `X-Request-Id` |
| `run_id` | no | Present when client sends valid optional header `X-Run-Id` (OpenAPI `RunIdHeader`) |
| `run_id_rejected` | no | `true` when `X-Run-Id` was sent but failed pattern validation |
| `method` | yes | HTTP method |
| `path` | yes | Express path (no query string; avoids logging sensitive query data at scale) |
| `operation` | yes | `search`, `availability`, `booking`, `health`, or `unknown` |
| `status` | yes | Response status code |
| `duration_ms` | yes | Wall time for the request |

Never log: `Authorization`, raw JWT, passenger names, payment tokens, or idempotency keys.

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

## AWS session checklist (M5 #50)

Deploy after ECS and ALB with `npm run aws:deploy:observability -- --session SESSION --run-id RUN_ID --deployment-profile aws-baseline|aws-optimized --expires-at …`.

| Doc section | AWS implementation |
| --- | --- |
| Correlation `run_id` | Structured logs include `run_id` from `X-Run-Id`; ECS tasks get `OTEL_RESOURCE_ATTRIBUTES` with the same id; custom metrics namespace `RailFlux/<RunId>`. |
| Primary SLO latency | Log metric filter `BookingRequestDurationMs` + alarm on p99 (default 2000 ms). |
| HTTP / booking errors | Log metric filters on `http_request` 5xx lines → `RailFlux/<RunId>`. |
| ECS / ALB / RDS resources | CloudWatch dashboard widgets (CPU, connections, ALB target p99). |
| SQS queue depth / age | Alarms on oldest message age and DLQ depth (optimized, when sqs-worker stack exists). |
| OpenTelemetry | W3C `tracecontext` propagators and sampler env on ECS; IAM allows X-Ray and `PutMetricData` for future SDK export. |
| Export | Dashboard + `GetMetricData` on namespace `RailFlux/<RunId>` for experiment artifacts. |

Smoke: `npm run aws:smoke:observability -- --session SESSION --run-id RUN_ID`.
