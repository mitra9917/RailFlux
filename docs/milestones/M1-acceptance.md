# M1 acceptance gate

**Milestone:** M1 — Contracts & repository scaffold  
**Status:** Passed  
**Recorded:** 2026-10-17

## Prerequisites (issues #1–#8)

| Issue | Deliverable | Evidence |
| --- | --- | --- |
| #1 | OpenAPI v1.0.0 frozen | [api-spec.yaml](../design/api-spec.yaml), [ADR-011](../decisions/ADR-011-api-v1-freeze.md) |
| #2 | Requirements traceability | [requirements-traceability.md](../requirements-traceability.md) |
| #3 | Monorepo layout | [README](../../README.md) repository layout |
| #4 | `@railflux/shared` | [packages/shared](../../packages/shared/README.md) |
| #5 | Core MySQL migration | [001_core_schema.sql](../../database/migrations/001_core_schema.sql) |
| #6 | Seed and reset scripts | [database/scripts](../../database/README.md) |
| #7 | Fixture checksum loader | [manifest.yaml](../../experiment/fixtures/manifest.yaml) `checksums` |
| #8 | GitHub Actions CI | [.github/workflows/ci.yml](../../.github/workflows/ci.yml) |

## Gate criteria

| Criterion | Verification |
| --- | --- |
| OpenAPI v1 frozen and validates | `npm run validate:openapi` |
| Fixture checksum verified before load | `npm run verify:fixture` |
| `@railflux/shared` builds and typechecks | `npm run build:shared` && `npm run typecheck:shared` |
| CI green on `main` | GitHub Actions workflow **CI** |
| Migrations apply on empty MySQL | CI job **MySQL migrate and fixture load**; locally `./database/scripts/load-fixture.sh` with MySQL 8 |

## Reproduce locally

```bash
npm run ci
# With MySQL 8 + mysql client:
./database/scripts/load-fixture.sh
./database/scripts/reset.sh
```

## Exit

M1 is complete. Begin **M2** (baseline read path): issue **#10**.
