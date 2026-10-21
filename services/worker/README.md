# Worker (optimized profile)

Consumes **`railflux-side-effects`** (ElasticMQ/SQS) and applies side effects idempotently via **`processed_events`** (M4 #36 / TC-010).

## Run locally

Requires MySQL, ElasticMQ, and messages published by the booking service (`OUTBOX_DELIVERY=sqs`).

```bash
cp services/worker/.env.example services/worker/.env
npm run build:shared && npm run build:baseline && npm run build:worker
npm run dev -w @railflux/worker
```

Integration: `npm run test:tc010` (MySQL + ElasticMQ).
