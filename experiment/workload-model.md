# Workload Model

## Primary open model

Tatkal-like arrivals are externally timed. Use k6 `constant-arrival-rate` and `ramping-arrival-rate` executors so offered traffic does not fall when the service slows.

Illustrative phases:

```text
-120s to 0s   background search and pre-issued synthetic session preparation
0s            instantaneous booking-release jump
0s to 90s     sustained peak
90s to 120s   decaying retries
120s to 180s  cooldown and terminal reconciliation
```

Rates are calibrated, not hard-coded as claims. Preallocated VUs should satisfy:

```text
peak iterations/second × client timeout seconds × 1.2
```

Count `dropped_iterations` as unmet demand.

## Cohorts

- **Browser:** normal think time across search → availability → booking.
- **Quick booker:** prepared session submits soon after release.
- **Retrying user:** bounded retries with jitter after timeout/429/5xx.
- **Abandoning user:** exits after latency or queue threshold.
- **Bot-like poller:** aggressive availability polling and concentrated identity/IP tags.
- **Duplicate submitter:** retries one booking with the same idempotency key.

Bot-like behavior is synthetic and targets RailFlux only.

Authentication issuance is outside the measured API in MVP v1. k6 receives pre-generated synthetic JWTs, so “session preparation” does not imply an unmodeled login endpoint.

## Operation mix

Initial main mix:

- 70% search;
- 20% availability;
- 10% booking.

Also run a booking-focused release scenario. The mixed ratio is reported as offered operations, not users.

## Inventory profiles

### Contention

Many users target a few train/date/class/quota buckets, and demand greatly exceeds inventory. Measures locking, sellout, retries, fairness, and correctness.

### Non-contention

Inventory exceeds demand across many buckets. Measures raw request/transaction capacity without sellout dominating.

## Cache conditions

- Cold cache does not mean cold tasks or cold database.
- Warm cache uses a fixed prewarming script and verified key count.
- Cold infrastructure/scale-from-zero is a separate elasticity scenario.

## Secondary closed model

Use `constant-vus` only for realistic end-to-end browser journeys, connection reuse, and think time. Do not use it for maximum burst-capacity claims.

## Retry policy

- Retry only declared transient failures.
- Exponential backoff with jitter and strict attempt limit.
- Reuse idempotency key for booking retries.
- Record original response, retry reason, and terminal resolution.
- Never retry validation, idempotency-conflict, or sold-out outcomes.

## Generator validation

- CPU below 70%.
- No memory pressure or local connection exhaustion.
- Network throughput below host limit.
- Scheduled-start delay within frozen tolerance.
- Time synchronization checked.
- One generator process per run unless a distributed run is explicitly declared.
