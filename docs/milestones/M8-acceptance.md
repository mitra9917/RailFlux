# M8 acceptance

**Milestone:** M8 — Frontend booking simulator  
**Gate issue:** #75 — `npm run gate:m8`, [runbook](../runbooks/m8-gate.md), [sign-off](./M8-gate-signoff.md)

| Issue | Deliverable |
| --- | --- |
| #71 | React + Vite scaffold under `frontend/`, synthetic auth, `VITE_API_BASE_URL`, `npm run build:frontend` |
| #72 | Search + availability pages, Vite proxy, `GET /v1/search` & `/v1/availability`, validation errors |
| #73 | Book + status pages, `Idempotency-Key`, 425 polling via GET booking, advisory banner on book |
| #74 | Advisory + freshness labels on search/availability/book (OpenAPI `Freshness`, cache-and-queue policy) |
| #75 | M8 gate — manual E2E against local API |
