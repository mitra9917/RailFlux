# Data, Transactions, and Correctness

## Core entities

```mermaid
erDiagram
    USERS ||--o{ BOOKINGS : creates
    TRAINS ||--o{ TRAIN_RUNS : schedules
    TRAIN_RUNS ||--o{ SEAT_INVENTORY : contains
    BOOKINGS ||--|{ BOOKING_PASSENGERS : includes
    BOOKINGS ||--o| PAYMENTS : has
    BOOKINGS ||--o{ OUTBOX_EVENTS : emits
    BOOKING_IDEMPOTENCY ||--o| BOOKINGS : resolves_to
    OUTBOX_EVENTS ||--o{ PROCESSED_EVENTS : handled_as

    USERS {
        uuid id PK
        string cohort
        datetime created_at
    }
    TRAINS {
        string train_no PK
        string name
        string source
        string destination
    }
    TRAIN_RUNS {
        uuid id PK
        string train_no FK
        date journey_date
    }
    SEAT_INVENTORY {
        uuid id PK
        uuid train_run_id FK
        string fixture_id
        string class_code
        string quota
        int initial_seats
        int available_seats
        int version
    }
    BOOKINGS {
        uuid id PK
        string run_id
        string simulated_pnr
        uuid user_id FK
        uuid inventory_id FK
        string status
        int seat_count
        decimal total_fare
        datetime created_at
    }
    BOOKING_PASSENGERS {
        uuid id PK
        uuid booking_id FK
        string synthetic_name
    }
    PAYMENTS {
        uuid id PK
        string run_id
        uuid booking_id FK
        string status
        string stub_sequence
    }
    BOOKING_IDEMPOTENCY {
        string idempotency_key_hash PK
        string run_id
        string request_hash
        string status
        uuid booking_id FK
        json response_body
        datetime expires_at
    }
    OUTBOX_EVENTS {
        uuid event_id PK
        string aggregate_type
        uuid aggregate_id
        string event_type
        json payload
        datetime published_at
    }
    PROCESSED_EVENTS {
        uuid event_id FK
        string run_id
        string handler_type
        datetime processed_at
    }
```

## Booking state machine

```mermaid
stateDiagram-v2
    [*] --> RECEIVED
    RECEIVED --> SOLD_OUT: no inventory
    RECEIVED --> PAYMENT_PENDING: inventory claimed
    PAYMENT_PENDING --> FAILED: authorization failed
    PAYMENT_PENDING --> CONFIRMED: payment accepted and commit
    CONFIRMED --> [*]
    SOLD_OUT --> [*]
    FAILED --> [*]
```

For the MVP, payment authorization is inside the transaction to keep the state model small. Its delay is bounded. A production design would avoid holding a database lock across an external payment call and use expiring holds/compensation.

## Required constraints

- Unique idempotency key hash.
- Unique simulated PNR.
- `available_seats >= 0`.
- Booking seat count is positive and no more than four.
- Unique processed side-effect key `(event_id, handler_type)`.
- Foreign keys between inventory, booking, payment, passenger, and outbox rows.
- `run_id` tags mutable experiment records; `fixture_id` identifies seeded inventory.

## Invariants

1. `confirmed_seats <= initial_inventory`.
2. `initial_inventory - final_inventory = confirmed_seats` for runs without cancellation.
3. One idempotency key maps to one request hash and one logical result.
4. One booking has at most one successful payment.
5. Every confirmed booking has a durable outbox event.
6. Every accepted event is pending, processed, or in the DLQ.
7. Displayed stale availability cannot cause an oversell.

## Idempotency behavior

- Hash the key and canonical request body; do not log raw credentials or passenger data.
- Same key + same request returns the stored result.
- Same key + different request returns `409 IDEMPOTENCY_CONFLICT`.
- An in-progress duplicate may wait briefly or return `409/425` with a status URL.
- Expiry must exceed the maximum client retry/reconciliation period.

## Reconciliation

Every measured run executes independent SQL checks for negative inventory, duplicate keys, duplicate successful payments, outbox gaps, final inventory mismatch, orphan rows, and non-terminal accepted requests. Any violation invalidates the run regardless of latency.
