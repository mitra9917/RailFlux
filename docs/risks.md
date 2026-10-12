# Risk Register

## High priority

### Cost overrun

- Signal: daily spend exceeds session estimate or unexplained resource appears.
- Mitigation: local-first, one profile at a time, expiry tags, alarms, no NAT, short sessions.
- Contingency: emergency teardown and pause at $100.

### Invalid comparison

- Signal: different fixture/version/resource settings, shared state, or unrandomized order.
- Mitigation: immutable run manifests, checksums, AB/BA randomization, parity review.
- Contingency: invalidate and rerun the pair.

### Booking correctness failure

- Signal: negative inventory, duplicate payment, mismatch, unresolved accepted request.
- Mitigation: atomic update, unique constraints, idempotency, outbox, reconciliation.
- Contingency: stop performance claims until corrected and rerun all affected cells.

### Load-generator bottleneck

- Signal: high generator CPU, start delay, dropped iterations unrelated to SUT.
- Mitigation: preflight, adequate VUs, local host validation, temporary EC2 only if necessary.
- Contingency: invalidate run and lower/redistribute generator load.

## Medium priority

### Autoscaling too slow for burst

Mitigation: designated prewarmed and scale-from-zero tests; separate fixed-capacity comparisons.

### Cache staleness or stampede

Mitigation: short TTL+jitter, advisory labeling, invalidation hints, single-flight, primary validation.

### Replica lag

Mitigation: expose freshness, never book from replica, record lag, protected fallback.

### SQS duplicate/lost side effect

Mitigation: transactional outbox, idempotent consumer, DLQ, backlog reconciliation.

### WAF false positives

Mitigation: count cohorts separately, begin in count mode, tune only before frozen campaign.

### CloudWatch cost or insufficient granularity

Mitigation: short retention, limited custom metrics, application/k6 one-second artifacts.

### AWS service quota or provisioning delay

Mitigation: preflight quotas, deploy one week before campaign, retain local fallback.

## Accepted limitations

- Single-AZ RDS can fail during an AZ incident.
- Public-IP Fargate is a budget-specific network compromise.
- Synthetic workload cannot establish IRCTC production performance.
- The six-week scope excludes multi-region and sophisticated anti-bot modeling.
