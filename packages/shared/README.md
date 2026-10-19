# @railflux/shared

TypeScript types and shared constants for [OpenAPI v1.0.0](../../docs/design/api-spec.yaml).

## Usage (services and frontend)

```json
{
  "dependencies": {
    "@railflux/shared": "0.0.0"
  }
}
```

In a workspace package, depend on `"@railflux/shared": "*"` and build shared first:

```bash
npm run build:shared
```

```typescript
import type { CreateBookingRequest, BookingResult } from '@railflux/shared';
import { HEADER_IDEMPOTENCY_KEY, RailFluxError } from '@railflux/shared';
```

Types are **hand-maintained** to match the frozen contract. When `api-spec.yaml` changes, update `src/api-types.ts` and bump per ADR-011.

Booking lifecycle helpers (`booking-state-machine.ts`) enforce [data-consistency.md](../../docs/design/data-consistency.md) transitions for baseline and optimized profiles.
