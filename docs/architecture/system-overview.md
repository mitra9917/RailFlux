# Unified System Architecture

RailFlux has two planes:

1. **System under test:** website, ingress, application, and data services.
2. **Experiment plane:** fixture creation, traffic generation, telemetry, reconciliation, analysis, and reporting.

```mermaid
flowchart TB
    Human[Human User] --> Frontend[React Frontend]
    Frontend --> Edge[CloudFront and cell-controlled WAF]
    LoadGen[k6 Load Generator] --> Edge
    Edge --> Alb[Application Load Balancer]

    Alb -->|"Baseline session"| Baseline[Baseline Monolith]
    Baseline --> BaselineDb[Baseline MySQL Primary]

    Alb -->|"Optimized session"| ReadSvc[Read Service]
    Alb -->|"Optimized session"| BookingSvc[Booking Service]
    ReadSvc --> Redis[Redis Cache]
    Redis -->|"Cache miss"| Replica[RDS Read Replica]
    BookingSvc --> Primary[RDS Primary]
    BookingSvc --> Queue[SQS]
    Queue --> Worker[Worker]
    Queue --> Dlq[DLQ]

    Controller[Experiment Controller] --> Fixture[Fixture and Reset]
    Fixture --> BaselineDb
    Fixture --> Primary
    Controller --> LoadGen

    Baseline --> Telemetry[Normalized Telemetry]
    ReadSvc --> Telemetry
    BookingSvc --> Telemetry
    Worker --> Telemetry
    LoadGen --> Telemetry
    Telemetry --> Reconcile[Correctness Reconciliation]
    Reconcile --> Analysis[Paired Analysis]
    Analysis --> Report[Results Dashboard and Report]
```

The branches are conceptual: baseline and optimized profiles are normally deployed and measured **sequentially**, not simultaneously.

## Runtime boundaries

- The frontend displays search, availability, booking, payment simulation, and confirmation.
- The edge layer serves static assets, applies managed/request-rate rules, and forwards `/api/*`.
- Every service implements the same versioned API contract and propagates `traceparent`, `run_id`, and `request_id`.
- The experiment controller is not on the customer request path.
- Results are written only after state reconciliation succeeds.

## Workload paths

### Read

Baseline reads query the primary database. Optimized reads use cache-aside Redis and fall back to a read replica. Displayed availability may be stale and is explicitly advisory.

### Booking

Both systems perform authoritative inventory validation on a primary MySQL transaction. The optimized service moves only non-critical post-commit work to SQS.

### Failure

Load and failure controls can stop a task, block Redis, delay a database call, pause workers, or fail the payment stub. Each failure is injected independently and recorded in the run manifest.

## Deployment profiles

- `local-baseline`: monolith + MySQL.
- `local-optimized`: read/booking services + MySQL + Redis + ElasticMQ + worker.
- `aws-baseline`: edge/ALB + monolith Fargate + Single-AZ RDS.
- `aws-optimized`: edge/ALB + split Fargate services + RDS primary/read replica + ElastiCache + SQS/DLQ + worker.

AWS profiles are temporary. Only one paid profile is required at a time.
