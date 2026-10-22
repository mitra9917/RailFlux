# M6 acceptance gate (M6 #62)

Validates the **experiment engine**: unit tests plus an optional **live** path when Docker MySQL, k6, and the API are available.

## Local gate

```bash
npm run gate:m6
```

### Always runs

1. `npm run ci`
2. `npm run test:m6-gate` — load tests, controller, manifest generator, result export, generator preflight

### Live smoke (skipped if prerequisites missing)

When `railflux-mysql`, k6, and `GET /health/live` on port 3000 are available:

1. `npm run db:reset`
2. `npm run experiment:generate-manifest` → `experiment/generated-gate/` (pair YAML export)
3. `npm run load:pt001` (includes generator preflight)
4. `npm run experiment:run -- --workload pt001` → run index + `result.schema.json` artifact
5. Schema validation via `validate-result-file.mjs`

Environment (live path):

```bash
export SYNTHETIC_JWT_SECRET='dev-only-change-me'
export MYSQL_PORT=3307
npm run compose:baseline   # or edge on :3000
npm run gate:m6
```

Optional: `M6_GATE_MANIFEST`, `M6_GATE_BASE_URL`.

## Milestone record

See [M6 acceptance](../milestones/M6-acceptance.md).
