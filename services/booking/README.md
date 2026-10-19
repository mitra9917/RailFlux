# Booking service (optimized profile)

Independent **`POST /v1/bookings`** and **`GET /v1/bookings/{id}`** (OpenAPI parity with baseline).

Search and availability are **not** mounted here — route those paths to the read service at the edge (M4 #32).

## Run locally

```bash
cp services/booking/.env.example services/booking/.env   # optional
npm run db:bootstrap
npm run build:shared && npm run build:baseline && npm run build:booking
npm run dev -w @railflux/booking
```

Default port **3002** (read service **3001**, edge **3000** when using the optimized stack).

With **`OUTBOX_DELIVERY=sqs`** (see `.env.example`), confirmed bookings publish `BOOKING_CONFIRMED` to ElasticMQ/SQS after commit (M4 #35). Baseline monolith keeps **`OUTBOX_DELIVERY=sync`**.

Integration: `npm run test:edge-routing`, `npm run test:outbox-sqs` (MySQL + ElasticMQ; `MYSQL_PORT=3307` for Compose).
