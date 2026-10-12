# Cache and Queue Design

## Cache policy

Redis is an optimization for advisory reads only.

Suggested keys:

```text
v1:search:{from}:{to}:{date}
v1:availability:{train_run_id}:{class}:{quota}
v1:train:{train_no}
v1:stations
```

Suggested initial TTLs:

- search: 60 seconds ± 10% jitter;
- displayed availability: 5 seconds ± 20% jitter;
- train metadata: 5 minutes ± 10%;
- station list: 1 hour ± 10%.

The original 30-second availability TTL is too stale for a high-contention demonstration. The UI must display freshness and treat results as advisory.

## Cache behavior

- Cache-aside reads.
- Versioned keys allow schema changes without unsafe mixed values.
- Negative caching is short-lived and limited to stable “not found” results.
- Single-flight/coalescing reduces thundering cache misses.
- Redis timeout is much shorter than the database/read API timeout.
- Circuit breaking prevents every request from waiting on an unhealthy cache.
- Booking commit can delete the relevant availability key as a best-effort hint, but correctness still relies on TTL and primary validation.

## Queue contracts

Queue: `railflux-side-effects`  
DLQ: `railflux-side-effects-dlq`

```json
{
  "schemaVersion": 1,
  "eventId": "uuid",
  "eventType": "BOOKING_CONFIRMED",
  "bookingId": "uuid",
  "runId": "run-id",
  "occurredAt": "RFC3339 timestamp",
  "payload": {
    "notificationTarget": "synthetic-user-id"
  }
}
```

Do not place names, email addresses, payment details, or raw idempotency keys in the message.

## Reliability

- Use a transactional outbox to close the database-commit/SQS-publish gap.
- A publisher retries unpublished outbox rows and records `published_at`.
- SQS visibility timeout exceeds expected handler time plus safety margin.
- Worker extends visibility for bounded long work.
- Redrive after three failed receives for the MVP.
- Retention covers the maximum planned experiment/recovery interval.
- Consumers are idempotent because Standard queues may deliver duplicates.

## Scaling signal

Use backlog per active worker:

```text
messages_visible / max(active_workers, 1)
```

Also monitor oldest-message age. Queue depth alone can scale incorrectly when processing times change.

## Failure acceptance

Worker loss must not fail committed bookings. After recovery:

- main queue returns to zero;
- no event is lost;
- no side effect is duplicated;
- poison messages reach the DLQ with diagnostic context;
- DLQ messages contain no sensitive payload.
