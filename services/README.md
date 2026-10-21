# Services

Node.js + TypeScript + Express applications.

| Path | Role |
| --- | --- |
| `baseline/` | Monolith: search, availability, booking, sync side effects (M2–M3) |
| `read/` | Optimized read path: search + availability on port **3001** (`npm run dev -w @railflux/read`) |
| `booking/` | Optimized write path: `/v1/bookings` on port **3002** (`npm run dev -w @railflux/booking`) |
| `edge/` | Local router: full OpenAPI `/v1` on port **3000** → read/booking upstreams |

Full optimized stack in Docker: `npm run compose:optimized` (see [infrastructure/compose/README.md](../infrastructure/compose/README.md)).
| `worker/` | SQS/ElasticMQ consumer; `processed_events` dedupe (port N/A — `npm run dev -w @railflux/worker`) |

All profiles implement [OpenAPI v1](../docs/design/api-spec.yaml). Import DTOs from [`@railflux/shared`](../packages/shared/README.md) instead of duplicating types.
