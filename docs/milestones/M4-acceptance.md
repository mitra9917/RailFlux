# M4 acceptance gate

**Milestone:** M4 — Optimized local profile  
**Status:** Passed (gate script + CI)  
**Recorded:** 2026-10-21

## Prerequisites (issues #31–#39)

| Issue | Deliverable | Evidence |
| --- | --- | --- |
| #31 | Read service | `@railflux/read`, `npm run test:read-tc001` |
| #32 | Booking + edge routing | `@railflux/booking`, `@railflux/edge`, `npm run test:edge-routing` |
| #33 | Redis cache-aside (TC-002) | `npm run test:tc002-cache` |
| #34 | Stampede coalescing (FT-009) | `npm run test:ft009-stampede` |
| #35 | Outbox → ElasticMQ | `npm run test:outbox-sqs` |
| #36 | Worker + processed_events (TC-010) | `npm run test:tc010` |
| #37 | DLQ path (FT-004) | `npm run test:ft004-dlq` |
| #38 | Compose optimized profile | `npm run compose:optimized`, [local Docker profiles](../local-docker-profiles.md) |
| #39 | Baseline vs optimized parity | `npm run test:profile-parity` |

## Gate criteria (#40)

| Criterion | Verification |
| --- | --- |
| Same API semantics baseline vs optimized | `npm run test:profile-parity` |
| M3 booking outcomes on optimized path | Parity booking test + shared baseline booking core in optimized services |
| TC-002 cache-aside | `npm run test:tc002-cache` |
| TC-010 worker dedupe | `npm run test:tc010` |
| Async outbox + DLQ | `npm run test:outbox-sqs`, `npm run test:ft004-dlq` |
| Optimized Compose builds | `docker compose --profile optimized build` |
| Unit + contract checks green | `npm run ci` |
| CI database-smoke | `.github/workflows/ci.yml` M4 integration steps |

## Catalog mapping (M4)

| Test catalog | npm script |
| --- | --- |
| TC-002 | `test:tc002-cache` |
| TC-010 | `test:tc010` |
| FT-004 | `test:ft004-dlq` |
| FT-009 | `test:ft009-stampede` |
| Parity | `test:profile-parity` |

Umbrella: `npm run test:m4-gate`

## Reproduce locally

```bash
# CI-equivalent (no Docker services required)
npm run ci

# Full M4 gate when Compose MySQL (and Redis/ElasticMQ for integration) are up
npm run gate:m4

# M4 integration bundle only
MYSQL_PORT=3307 npm run test:m4-gate
```

## Exit

M4 optimized local profile is complete. Next: **M5** AWS deployment per [implementation-plan.md](../implementation-plan.md).
