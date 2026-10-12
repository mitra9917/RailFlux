# Request and Failure Flows

## Search and displayed availability

```mermaid
sequenceDiagram
    participant C as Client
    participant R as ReadService
    participant X as Redis
    participant D as ReadReplica
    C->>R: GET search or availability
    R->>X: Get versioned cache key
    alt Cache hit
        X-->>R: Cached advisory result
    else Cache miss or cache unavailable
        R->>D: Read query with timeout
        D-->>R: Result and replica timestamp
        R->>X: Set TTL with jitter
    end
    R-->>C: Result plus freshness metadata
```

Concurrent misses use single-flight/coalescing per key where practical to reduce cache stampedes. Search TTL is longer than availability TTL; both include jitter.

## Booking

```mermaid
sequenceDiagram
    participant C as Client
    participant B as BookingService
    participant P as PaymentStub
    participant D as RDSPrimary
    participant O as OutboxPublisher
    participant Q as SQS
    C->>B: POST booking with Idempotency-Key
    B->>D: Begin and reserve idempotency key
    alt Completed duplicate
        D-->>B: Stored terminal response
        B-->>C: Same logical response
    else New request
        B->>D: Atomic inventory claim
        alt Sold out
            D-->>B: Zero rows affected
            B->>D: Store SOLD_OUT and commit
            B-->>C: SOLD_OUT
        else Inventory claimed
            B->>P: Deterministic authorization
            alt Payment failure
                B->>D: Rollback claim and store failure
                B-->>C: FAILED
            else Payment success
                B->>D: Create booking and outbox event, then commit
                B-->>C: CONFIRMED with simulated PNR
                O->>D: Read unpublished outbox event
                O->>Q: Publish side effect
                O->>D: Mark event published
            end
        end
    end
```

The publisher is logically separate from the synchronous response path. A direct post-commit SQS send can lose side effects if the process stops between commit and publish. In baseline mode, the monolith processes the same durable outbox event synchronously without SQS.

## Worker delivery

SQS Standard is at-least-once and unordered:

1. receive with long polling;
2. claim a unique `(event_id, handler_type)` processing record;
3. perform the simulated side effect;
4. mark complete;
5. delete message;
6. after repeated failure, SQS redrive moves it to the DLQ.

## Client timeout after commit

The client may time out after the database commits but before receiving a response. Retrying the same idempotency key returns the committed result. Reconciliation treats client timeout as unknown until the booking status is queried.

## Cache failure

Redis calls use short timeouts and a circuit breaker. Reads fall back with bounded database concurrency. Booking is unaffected because it never depends on Redis.

## Worker failure

Bookings continue after durable commit/outbox creation. Queue depth and oldest-message age rise. Recovery is complete when the backlog drains and deduplication records show no repeated side effects.
