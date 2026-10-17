# Baseline monolith (`@railflux/baseline`)

Node.js + TypeScript + Express service for the **baseline** profile (single process for read + booking paths in later issues).

## Run locally

Requires MySQL with schema and fixture loaded (`../../database/scripts/load-fixture.sh`).

```bash
cp .env.example .env
# from repository root:
npm install
npm run build:shared
npm run dev -w @railflux/baseline
```

Verify:

```bash
curl -s http://127.0.0.1:3000/health/live
curl -s http://127.0.0.1:3000/health/ready
```

`/health/ready` returns **503** until MySQL is reachable and the database exists.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev -w @railflux/baseline` | Hot reload via `tsx` |
| `npm run build -w @railflux/baseline` | Compile to `dist/` |
| `npm run start -w @railflux/baseline` | Run compiled server |

OpenAPI v1 routes (`/v1/*`) are added in M2 issues #12–#14.
