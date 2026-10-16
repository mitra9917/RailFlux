# Services

Node.js + TypeScript + Express applications.

| Path | Role |
| --- | --- |
| `baseline/` | Monolith: search, availability, booking, sync side effects (M2–M3) |
| `read/` | Optimized read path: search + availability with cache (M4) |
| `booking/` | Optimized write path: bookings + outbox publish (M4) |
| `worker/` | SQS/ElasticMQ consumer for side effects (M4) |

All profiles implement [OpenAPI v1](../docs/design/api-spec.yaml). Import DTOs from [`@railflux/shared`](../packages/shared/README.md) instead of duplicating types.
