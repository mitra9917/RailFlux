# Frontend

React + Vite booking simulator (**Milestone M8**). Consumes [OpenAPI v1](../docs/design/api-spec.yaml); availability is **advisory** only (freshness copy in #74).

## Prerequisites

- Node.js ≥ 20
- API running locally (`npm run compose:baseline` or `compose:optimized` on port **3000**)

## Setup

```bash
cp frontend/.env.example frontend/.env
npm install
npm run build:shared
```

## Develop

```bash
npm run dev:frontend
```

Open http://127.0.0.1:5173 — Vite **proxies** `/v1/*` and `/health/*` to port 3000 (no CORS setup needed).

1. **Home** — synthetic sign-in, ping health  
2. **Search** — SAB → SAA (defaults), open **Availability** on a train run  
3. **Book** — from 3A availability, POST with `Idempotency-Key`; on **425** the UI polls GET until terminal  
4. **Booking status** — `/bookings/:id` for slow-path polling  

Sign in with the default demo UUID (seeded by `db-init` / `npm run db:load`) or `npm run mint:jwt -- 11111111-1111-4111-8111-111111111111 browser`.

After pulling fixture seed changes, reload MySQL: `npm run db:load` (or recreate the compose `db-init` / MySQL volume).

## Build

```bash
npm run build:frontend
npm run preview -w @railflux/frontend
```

## Synthetic auth (no real PII)

| Method | When |
| --- | --- |
| `VITE_SYNTHETIC_JWT_SECRET` + **Mint dev JWT** | Local dev only (same secret as backend `SYNTHETIC_JWT_SECRET`) |
| Paste token from `npm run mint:jwt` | When you do not expose the secret to Vite |

Never collect real names, payment cards, or IRCTC credentials in this UI.

## Environment

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Empty in dev (same-origin + proxy). Production: API origin or `/api` prefix |
| `VITE_DEV_API_TARGET` | Vite-only proxy target (default `http://127.0.0.1:3000`) |
| `VITE_SYNTHETIC_JWT_SECRET` | Optional dev JWT signing |
| `VITE_SYNTHETIC_USER_ID` | Default synthetic UUID |

Local API routes are **`/v1/*`**, not **`/api`** — do not open `http://127.0.0.1:3000/api` in the browser.
