# Read service (optimized profile)

Independent **`GET /v1/search`** and **`GET /v1/availability`** (OpenAPI parity with baseline; Redis cache-aside is M4 TC-002).

Bookings are **not** mounted here — route `/v1/bookings` to the booking service at the edge (`@railflux/edge`, M4 #32).

## Run locally

```bash
cp services/read/.env.example services/read/.env   # optional
npm run db:bootstrap
npm run build:shared && npm run build:baseline && npm run build:read
npm run dev -w @railflux/read
```

Default port **3001** (baseline booking monolith remains **3000**).

```bash
TOKEN=$(npm run mint:jwt --silent -- 11111111-1111-4111-8111-111111111111)
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:3001/v1/search?from=SAB&to=SAA&date=2026-04-01"
```

Integration: `npm run test:read-tc001` (MySQL + fixture; set `MYSQL_PORT=3307` for Compose).
