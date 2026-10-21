# M3 acceptance gate

**Milestone:** M3 — Baseline booking correctness  
**Status:** Passed (gate script + CI)  
**Recorded:** 2026-10-19

## Prerequisites (issues #19–#29)

| Issue | Deliverable | Evidence |
| --- | --- | --- |
| #19 | Booking state machine | `@railflux/shared` `booking-state-machine.ts`, unit tests |
| #20 | Atomic inventory claim | `claim-inventory.ts`, `npm run test:claim-inventory` (TC-004) |
| #21–#22 | Idempotency replay / conflict / 425 | `booking-idempotency.ts`, TC-005 / TC-006 integration |
| #23 | Deterministic payment stub | `payment-stub.ts`, `tests/payment-stub.test.mjs` |
| #24 | Payment failure inventory release | `payment-failure-release.ts`, TC-008 integration |
| #25 | Baseline synchronous outbox | `booking-outbox.ts`, `npm run test:booking-outbox` |
| #26 | GET booking status | `GET /v1/bookings/{id}`, TC-009 integration |
| #27 | Post-run correctness SQL runner | `database/scripts/run-correctness.mjs`, `npm run test:correctness` |
| #28 | Automated TC-003–TC-009 (baseline) | `npm run test:m3-tc003-009`, traceability matrix |
| #29 | Concurrent last seat (TC-007) | `npm run test:tc007-contention` |

## Gate criteria (#30)

| Criterion | Verification |
| --- | --- |
| No oversell under parallel contenders | TC-007: exactly one `CONFIRMED` for one seat |
| No duplicate successful payment / inventory drift | `experiment/correctness.sql` via `npm run run:correctness` |
| Idempotency and terminal booking semantics | TC-005, TC-006, TC-008, TC-009 |
| Full booking create path | TC-003 POST `/v1/bookings` |
| Unit + contract checks green | `npm run ci` |
| CI database-smoke | `.github/workflows/ci.yml` integration steps |

## Catalog mapping

| Test catalog | npm script |
| --- | --- |
| TC-003 | `test:booking-create` |
| TC-004 | `test:claim-inventory`, `test:booking-create` |
| TC-005 | `test:idempotency-replay` |
| TC-006 | `test:idempotency-conflict` |
| TC-007 | `test:tc007-contention` |
| TC-008 | `test:payment-failure`, `test:booking-create` |
| TC-009 | `test:get-booking`, `test:booking-create` |

Umbrella: `npm run test:m3-tc003-009`

## Reproduce locally

```bash
# CI-equivalent (no MySQL required)
npm run ci

# Full M3 gate when Compose MySQL is up (host 3307)
npm run gate:m3

# Booking catalog only (MySQL required)
MYSQL_PORT=3307 npm run test:m3-tc003-009
```

## Exit

M3 baseline booking correctness is complete. Next: **M4** optimized profile — see [M4 acceptance gate](M4-acceptance.md).
