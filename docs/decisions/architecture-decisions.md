# Architecture Decision Records

## ADR-001: Publicly informed synthetic baseline

**Decision:** Model a legacy-style railway booking system; do not label it the IRCTC architecture.  
**Reason:** Public sources expose capacity and high-level controls, not internal topology.  
**Consequence:** Conclusions compare RailFlux architectures only.

## ADR-002: ALB instead of API Gateway

**Decision:** Use CloudFront/WAF → public ALB → ECS.  
**Reason:** API Gateway HTTP API plus private ALB retains ALB cost and adds complexity; HTTP APIs do not provide REST API usage plans.  
**Consequence:** Authentication, request schema, and fine-grained quotas are application responsibilities.

## ADR-003: Sequential randomized paired runs

**Decision:** Deploy/measure profiles sequentially with isolated restored state and randomized AB/BA pair order.  
**Reason:** Mirrored writes interfere with scarce inventory and shared dependencies.  
**Consequence:** Stronger internal validity; no live side-by-side traffic visualization.

## ADR-004: Primary database is authoritative

**Decision:** Booking inventory checks and mutation occur on the RDS primary transaction.  
**Reason:** Cache and replica lag make read-optimized data unsafe for allocation.  
**Consequence:** The primary remains the write bottleneck to optimize carefully.

## ADR-005: Transactional outbox for side effects

**Decision:** Commit an outbox event with a confirmed booking, then publish to SQS.  
**Reason:** Direct post-commit publication can lose messages during a process crash.  
**Consequence:** A small publisher and outbox cleanup process are required.

## ADR-006: Open-model traffic is primary

**Decision:** Use k6 arrival-rate executors for burst/capacity claims; closed VU journeys are secondary.  
**Reason:** Real arrivals do not stop because the service slows, and closed models suffer coordinated omission.  
**Consequence:** Dropped iterations and generator capacity become first-class metrics.

## ADR-007: Public-IP Fargate for the budget profile

**Decision:** Place Fargate tasks in public subnets, locked to ALB inbound, while data remains private.  
**Reason:** Avoid NAT Gateway hourly/processing costs.  
**Consequence:** This is a student cost trade-off, not the recommended production topology.

## ADR-008: Expensive services are ephemeral

**Decision:** ALB, WAF, ElastiCache, read replica, extra tasks, and load-generator EC2 exist only during scheduled sessions.  
**Reason:** Preserve credits and prevent idle spend.  
**Consequence:** Provisioning and warm-up time are part of operations, not primary performance measurements.

## ADR-009: Single-AZ academic database

**Decision:** Use Single-AZ RDS for principal experiments.  
**Reason:** Multi-AZ cost does not answer the core read/write optimization question.  
**Consequence:** Database-AZ resilience is explicitly untested.

## ADR-010: CloudFormation

**Decision:** Use native CloudFormation with baseline/optimized parameters or nested stacks.  
**Reason:** Course alignment, repeatability, and no additional state backend.  
**Consequence:** Templates must expose session limits, tags, and teardown-safe dependencies.

## ADR-011: HTTP API v1.0.0 freeze

**Decision:** Freeze `docs/design/api-spec.yaml` at version **1.0.0** for all baseline and optimized implementations.  
**Reason:** M1 gate requires a stable contract before services and tests are scaffolded.  
**Consequence:** Breaking API changes need a new major version and ADR update. See [ADR-011 detail](ADR-011-api-v1-freeze.md).
