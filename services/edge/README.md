# Edge router (optimized local profile)

Single entry port exposing the full OpenAPI **`/v1/*`** surface:

| Path | Upstream |
| --- | --- |
| `/v1/search`, `/v1/availability` | read service (`READ_UPSTREAM`, default `http://127.0.0.1:3001`) |
| `/v1/bookings` | booking service (`BOOKING_UPSTREAM`, default `http://127.0.0.1:3002`) |

`/health/live` is local; `/health/ready` requires both upstream ready probes.

## Run locally

Start read and booking first, then edge:

```bash
npm run db:bootstrap
npm run build:shared && npm run build:baseline && npm run build:read && npm run build:booking && npm run build:edge

# three terminals (or background):
npm run dev -w @railflux/read
npm run dev -w @railflux/booking
npm run dev -w @railflux/edge
```

Default edge port **3000** (same as baseline monolith — do not run both).

Integration: `npm run test:edge-routing`.
