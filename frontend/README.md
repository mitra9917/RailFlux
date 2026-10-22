# Frontend

React + Vite booking simulator (**Milestone M8**). Consumes [OpenAPI v1](../docs/design/api-spec.yaml); availability is **advisory** only (labeling in #73).

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

Open http://127.0.0.1:5173 — use **Synthetic sign-in** with a fixture UUID or `npm run mint:jwt -- 11111111-1111-4111-8111-111111111111 browser`.

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
| `VITE_API_BASE_URL` | API prefix, default `http://127.0.0.1:3000/api` |
| `VITE_SYNTHETIC_JWT_SECRET` | Optional dev JWT signing |
| `VITE_SYNTHETIC_USER_ID` | Default synthetic UUID |
