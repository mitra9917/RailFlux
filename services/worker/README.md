# Worker (optimized profile)

Consumes **`railflux-side-effects`** (ElasticMQ/SQS) and applies side effects idempotently via **`processed_events`** (M4 #36 / TC-010). Poison messages (no matching outbox, invalid payload, or handler failure) are left on the queue for SQS redrive to **`railflux-side-effects-dlq`** after three receives (M4 #37 / FT-004).

## Run locally

Requires MySQL, ElasticMQ, and messages published by the booking service (`OUTBOX_DELIVERY=sqs`).

```bash
cp services/worker/.env.example services/worker/.env
npm run build:shared && npm run build:baseline && npm run build:worker
npm run dev -w @railflux/worker
```

Integration: `npm run test:tc010`, `npm run test:ft004-dlq` (MySQL + ElasticMQ). For local dev, create the main queue with a redrive policy pointing at the DLQ (see `ensureSideEffectsQueueWithRedrive` in baseline outbox SQS helpers).
