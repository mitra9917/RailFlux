# ADR-011: Freeze HTTP API v1.0.0 for implementation

**Status:** Accepted  
**Date:** 2026-10-13

## Context

M1 requires an implementable API contract before services, tests, and the shared TypeScript package are scaffolded. The OpenAPI document previously carried version `1.0.0-planning`.

## Decision

1. Promote `docs/design/api-spec.yaml` to **`1.0.0`** as the authoritative RailFlux HTTP contract.
2. Baseline and optimized profiles expose the **same** `/v1/*` surface; routing differs internally only.
3. Optional header **`X-Run-Id`** correlates experiment telemetry; it is not required for casual local use.
4. Travel classes **`SL`, `3A`, `2A`** and quota **`TATKAL`** match the fixture manifest v1.
5. **`Freshness.cacheStatus`** includes **`BYPASS`** for baseline and cache-disabled reads.
6. Breaking path or semantic changes after this ADR require a new major version and an ADR amendment.

## Consequences

- Implementation targets OpenAPI `1.0.0` until the principal experiment code freeze in the run manifest.
- Issue M1-P1 (traceability matrix) maps test catalog IDs to these operationIds.
- Frontend (M8) consumes the same contract via generated or shared types.

## References

- [api-spec.yaml](../design/api-spec.yaml)
- [data-consistency.md](../design/data-consistency.md)
- [request-flows.md](../architecture/request-flows.md)
