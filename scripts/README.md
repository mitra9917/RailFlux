# Scripts

| Script | Purpose |
| --- | --- |
| `validate-openapi.sh` | Validate `docs/design/api-spec.yaml` (also `npm run validate:openapi`) |
| `npm run ci` | Full local CI (see `.github/workflows/ci.yml`) |
| `bootstrap_github_issues.py` | Idempotently recreate GitHub labels, milestones, and tracked issues |
| `m1-gate.sh` | M1 acceptance (`npm run ci`) |
| `m2-gate.sh` | M2 acceptance (`npm run gate:m2`) |
| `m3-gate.sh` | M3 booking correctness (`npm run gate:m3`) |

Database fixture (under `database/scripts/`):

| Script | Purpose |
| --- | --- |
| `verify-fixture.mjs` | Fail closed if manifest checksums do not match schema/seed |
| `load-fixture.sh` | Verify + seed |
| `update-manifest-checksums.mjs` | Regenerate `checksums` in `experiment/fixtures/manifest.yaml` |

Run from repository root unless noted.
