# M8 acceptance gate (M8 #75)

Validates the **frontend booking simulator** against the OpenAPI contract and DoD product items for M8.

## Local gate (CI parity)

```bash
npm run gate:m8
```

### Always runs

1. `npm run ci`
2. `npm run typecheck:frontend` + `npm run build:frontend`
3. `npm run test:m8-gate` — frontend contract tests + gate wiring

### Optional live API flow

When Docker API is on port **3000** (baseline or optimized):

```bash
npm run compose:optimized   # or compose:baseline
export SYNTHETIC_JWT_SECRET=dev-only-change-me
npm run gate:m8
```

Runs `npm run test:m8-simulator-flow` (TC-001 search → availability → book → GET).

Override URL: `M8_GATE_BASE_URL=http://127.0.0.1:3000 npm run gate:m8`

Ensure fixture includes the demo user after seed changes:

```bash
MYSQL_HOST=127.0.0.1 MYSQL_PORT=3307 npm run db:load
```

### Sign-off (milestone close)

1. Complete [M8-gate-signoff.md](../milestones/M8-gate-signoff.md) (all `[x]` items).
2. Run:

```bash
M8_GATE_SIGNOFF=docs/milestones/M8-gate-signoff.md npm run gate:m8
```

Or verify sign-off only:

```bash
npm run experiment:verify-m8-acceptance
```

## Manual UI checklist (simulator_flow_local)

1. `npm run dev:frontend` — http://127.0.0.1:5173 (or localhost)
2. Home — **Mint dev JWT** for `11111111-1111-4111-8111-111111111111`, ping health
3. Search — SAB → SAA, open Availability on a run
4. Availability — 3A Tatkal, confirm advisory + freshness, **Book 3A Tatkal**
5. Book — submit; confirm status page shows terminal booking

## Related

- [frontend/README.md](../../frontend/README.md)
- [local Docker profiles](../local-docker-profiles.md) — baseline vs optimized on the same `:3000` URLs
