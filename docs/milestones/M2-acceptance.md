# M2 acceptance gate

**Milestone:** M2 — Baseline read path (local)  
**Status:** Passed  
**Recorded:** 2026-10-19

## Prerequisites (issues #10–#17)

| Issue | Deliverable | Evidence |
| --- | --- | --- |
| #10 | Baseline monolith scaffold + MySQL pool | `@railflux/baseline`, [services/baseline/README.md](../../services/baseline/README.md) |
| #11 | Synthetic JWT on `/v1/*` | [synthetic-jwt.ts](../../packages/shared/src/synthetic-jwt.ts), OpenAPI `syntheticJwt` |
| #12 | `GET /v1/search` | [search route](../../services/baseline/src/routes/search.ts), TC-001 search cases |
| #13 | `GET /v1/availability` (DB path) | [availability route](../../services/baseline/src/routes/availability.ts), `cacheStatus=BYPASS` |
| #14 | `/health/live` and `/health/ready` | [health routes](../../services/baseline/src/routes/health.ts), Compose/ALB probes |
| #15 | Structured logging + `X-Run-Id` | [request-logging middleware](../../services/baseline/src/middleware/request-logging.ts), [observability](../operations/observability.md) |
| #16 | TC-001 integration tests | [tests/integration/tc001-integration.test.mjs](../../tests/integration/tc001-integration.test.mjs) |
| #17 | Docker Compose baseline profile | [compose/README.md](../../infrastructure/compose/README.md), `db-init` + `baseline` services |

## Gate criteria

| Criterion | Verification |
| --- | --- |
| Deterministic fixture checksum before load | `npm run verify:fixture`; CI **MySQL migrate and fixture load** |
| OpenAPI v1 validates; read paths match contract | `npm run validate:openapi`; TC-001 asserts response shape + error codes |
| TC-001 passes against baseline + MySQL | CI job **MySQL migrate and fixture load** → `npm run test:tc001` |
| Docker Compose baseline profile builds and enables read flow | CI **Lint, test, and contract checks** → Compose image build; locally `npm run compose:baseline` |
| Unit + type checks green | CI **Lint, test, and contract checks** → `npm run ci` |

## Catalog mapping

| Test catalog | Evidence |
| --- | --- |
| **[Both] TC-001** Search / availability validation and success paths | `npm run test:tc001` |
| **PT-001** (preflight smoke) | `npm run health:check` against running baseline |

## Reproduce locally

```bash
# CI-equivalent (no MySQL required)
npm run ci

# Full M2 gate when Docker MySQL is up (host 3307)
npm run gate:m2

# End-to-end read path in containers
npm run compose:baseline
export SYNTHETIC_JWT_SECRET=dev-only-change-me
TOKEN=$(node scripts/mint-synthetic-jwt.mjs 11111111-1111-4111-8111-111111111111)
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:3000/v1/search?from=SAB&to=SAA&date=2026-04-01"
```

## Exit

M2 is complete. **M3** booking correctness: see [M3 acceptance gate](M3-acceptance.md).
