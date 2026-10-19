# Requirements Traceability

This matrix links **HTTP API v1.0.0** ([OpenAPI](../design/api-spec.yaml), [ADR-011](decisions/ADR-011-api-v1-freeze.md)) to the [test catalog](../experiment/test-catalog.md), design docs, and acceptance evidence. Every v1 `operationId` maps to at least one catalog test ID.

**Legend:** **P** = primary evidence for that operation; **S** = supporting / multi-operation scenario.

---

## HTTP API v1.0.0 → test catalog

| operationId | Method & path | Profile | Catalog tests | Requirement / behavior |
| --- | --- | --- | --- | --- |
| `searchTrains` | `GET /v1/search` | Both | **P** TC-001; **S** PT-001, PT-005, PT-009, ST-003 | Valid/invalid `from`/`to`/`date`; response includes `items` + advisory `freshness`. |
| `getAvailability` | `GET /v1/availability` | Both | **P** TC-001 (contract/validation); **S** PT-005 | Baseline: DB path with `cacheStatus=BYPASS`. |
| `getAvailability` | `GET /v1/availability` | Optimized | **P** TC-002; **S** PT-008, FT-002, FT-009 | Cache miss then hit; freshness metadata; stampede bounded (FT-009). |
| `createBooking` | `POST /v1/bookings` | Both | **P** TC-003, TC-004, TC-005, TC-006, TC-007, TC-008; **S** FT-007, PT-005, PT-006, PT-007 | Idempotency-Key; atomic claim; payment stub; terminal statuses; reconciliation SQL. |
| `getBooking` | `GET /v1/bookings/{bookingId}` | Both | **P** TC-009; **S** TC-005, FT-008 | Status after client timeout; idempotent replay alignment. |
| `liveness` | `GET /health/live` | Both | **P** PT-001; **S** Run acceptance preflight | Process up; used before k6 smoke and deploy checks. |
| `readiness` | `GET /health/ready` | Both | **P** PT-001; **S** FT-001, deployment smoke | Dependencies ready; fails closed with `503` when DB/cache/queue unavailable. |

### API cross-cutting (all `/v1/*` operations)

| Concern | Design | Catalog tests | Evidence |
| --- | --- | --- | --- |
| Synthetic JWT (`syntheticJwt`) | OpenAPI `securitySchemes`; no real IRCTC credentials | ST-006 | No raw token/passenger/payment/idempotency key in logs |
| `X-Run-Id` (optional) | [Observability](operations/observability.md) | PT-001, all accepted runs | Metrics/logs tagged per `run_id` in manifests |
| Error contract (`ErrorResponse`, `BookingResult.errorCode`) | [api-spec.yaml](../design/api-spec.yaml) | TC-001, TC-004, TC-006, TC-008 | Assert expected HTTP status + body codes in integration tests |
| Post-run invariants | [data-consistency.md](design/data-consistency.md), [correctness.sql](../experiment/correctness.sql) | TC-003–TC-010, Run acceptance | Any reconciliation failure invalidates the run |

### Baseline automated catalog tests (M3 #28)

| Catalog ID | npm script | Integration test file |
| --- | --- | --- |
| TC-003 | `npm run test:booking-create` | `tests/integration/booking-create.test.mjs` |
| TC-004 | `npm run test:claim-inventory`, `test:booking-create` | `claim-inventory.test.mjs`, `booking-create.test.mjs` |
| TC-005 | `npm run test:idempotency-replay` | `idempotency-replay.test.mjs` |
| TC-006 | `npm run test:idempotency-conflict` | `idempotency-conflict.test.mjs` |
| TC-007 | `npm run test:tc007-contention` | `tests/integration/tc007-contention.test.mjs` |
| TC-008 | `npm run test:payment-failure`, `test:booking-create` | `payment-failure.test.mjs`, `booking-create.test.mjs` |
| TC-009 | `npm run test:get-booking`, `test:booking-create` | `get-booking.test.mjs`, `booking-create.test.mjs` |

Umbrella: `npm run test:m3-tc003-009` (includes TC-007).

### Optimized-only async path (not separate OpenAPI operations)

Side effects are triggered by `createBooking` but validated via worker/queue behavior:

| Design | Catalog tests | Linked operations |
| --- | --- | --- |
| Transactional outbox → SQS → worker | **P** TC-010; **S** FT-003, FT-004 | `createBooking` (commit), reconciliation SQL |

---

## Thematic requirements (unchanged scope)

### Correctness

- **Requirement:** no oversell or duplicate charge.
- **Design:** primary atomic claim, unique idempotency, payment constraint.
- **API:** `createBooking`, `getBooking`.
- **Tests:** TC-003–TC-009.
- **Metrics/evidence:** reconciliation SQL, confirmed seats, oversells, duplicate charges.
- **Acceptance:** zero violations; otherwise run invalid.

### Peak-load performance

- **Requirement:** sustain synchronized arrivals with bounded tail latency.
- **Design:** split services, cache, independent scaling, bounded retries.
- **API:** all `/v1/*` under load; admission `429` on `createBooking`.
- **Tests:** PT-002–PT-006 and PT-011.
- **Metrics:** offered/started/completed/dropped, terminal p99, technical errors.
- **Acceptance:** frozen SLO in `hypotheses.yaml`.

### Read offload

- **Requirement:** reduce authoritative database read pressure.
- **Design:** cache-aside Redis and read replica.
- **API:** `searchTrains`, `getAvailability`.
- **Tests:** TC-002, PT-008, FT-002, FT-009.
- **Metrics:** cache hit ratio, replica queries, primary CPU/connections, read latency.
- **Acceptance:** H5 effect with unchanged correctness.

### Asynchronous resilience

- **Requirement:** non-critical side effects must not extend optimized booking latency or be lost.
- **Design:** transactional outbox, SQS/DLQ, idempotent worker.
- **API:** `createBooking` (commit boundary).
- **Tests:** TC-010, FT-003, FT-004.
- **Metrics:** queue depth/age, outbox gaps, duplicate handlers, drain time.
- **Acceptance:** committed bookings unaffected; eventual processing or declared DLQ.

### Abuse resistance

- **Requirement:** reduce bot-like backend pressure without harming legitimate users.
- **Design:** cell-controlled WAF/rate rules and cohort-aware admission.
- **API:** edge before ALB; `429` admission on `createBooking` where implemented.
- **Tests:** PT-009, ST-001–ST-003.
- **Metrics:** allowed/blocked rate, legitimate completion, false positives.
- **Acceptance:** H4 thresholds.

### Security

- **Requirement:** least privilege and private data services.
- **Design:** task-specific IAM, SG matrix, private RDS/Redis, OAC, secret handling.
- **API:** `syntheticJwt`; health unauthenticated by design.
- **Tests:** ST-004–ST-006.
- **Evidence:** IAM negative tests, network reachability, log scan.
- **Acceptance:** no direct origin/data access or sensitive logging.

### Observability

- **Requirement:** explain performance and recovery by request/run.
- **Design:** structured logs, OpenTelemetry, common tags, CloudWatch.
- **API:** optional `X-Run-Id` on `/v1/*`.
- **Tests:** every accepted experiment run.
- **Metrics:** complete client/server/resource/trace artifacts.
- **Acceptance:** missing mandatory telemetry invalidates the run.

### Cost

- **Requirement:** preserve most of the $200 credit allocation.
- **Design:** local-first, ephemeral profiles, no NAT/API Gateway/Multi-AZ.
- **Tests:** deployment/teardown smoke and cost audit.
- **Metrics:** estimated hourly and actual run cost, orphan inventory.
- **Acceptance:** $40–$70 target; stop/review at $100; no unintended paid orphan.

### Reproducibility

- **Requirement:** another contributor can recreate a run.
- **Design:** fixture checksums, seeds, immutable versions, run manifests, AB/BA order.
- **Tests:** clean-state walkthrough.
- **Evidence:** manifest, artifact links, protocol and runbook.
- **Acceptance:** second contributor reproduces setup and obtains a valid smoke run.

---

## Coverage checklist (M1-P1 gate)

| operationId | ≥1 catalog test ID |
| --- | --- |
| `searchTrains` | TC-001 ✓ |
| `getAvailability` | TC-001 / TC-002 ✓ |
| `createBooking` | TC-003 ✓ |
| `getBooking` | TC-009 ✓ |
| `liveness` | PT-001 ✓ |
| `readiness` | PT-001 ✓ |

---

## Maintenance

When OpenAPI or the test catalog changes, update this file in the same PR. Breaking API changes require [ADR-011](decisions/ADR-011-api-v1-freeze.md) revision and a version bump in [api-spec.yaml](../design/api-spec.yaml).
