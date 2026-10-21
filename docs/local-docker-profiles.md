# Local Docker: baseline vs optimized

RailFlux is **not** IRCTC and does not mimic proprietary IRCTC systems. It is **our** Tatkal-like **experiment** with two architectures we compare under the same tests:

| Profile | What it models | How you call the API |
| --- | --- | --- |
| **Baseline** | Legacy-style **one Node app** does search, availability, booking, and side effects **synchronously** in one process | `http://127.0.0.1:3000` → container `railflux-baseline` |
| **Optimized** | **Split services** like the AWS design: read path, write path, cache, queue, worker | `http://127.0.0.1:3000` → container `railflux-edge` (router) |

Run **one profile at a time**. Both use port **3000** for the public API, but they are different stacks.

## Optimized stack (what you have when `compose:optimized` succeeds)

```text
Your browser / curl
        │
        ▼
  :3000  railflux-edge          ← only this needs a host port
        ├── /v1/search, /v1/availability  →  railflux-read:3001
        └── /v1/bookings                  →  railflux-booking:3002
                                                      │
                                                      ▼ outbox
                                               railflux-elasticmq:9324 (SQS)
                                                      │
                                                      ▼
                                               railflux-worker (polls queue)

  railflux-read  ──►  railflux-redis:6379  (cache; optional for correctness)
  all app services ──►  railflux-mysql:3306  (host :3307)
```

## Baseline stack

```text
Your browser / curl
        │
        ▼
  :3000  railflux-baseline  (everything in one container)
        │
        └──►  railflux-mysql:3306  (host :3307)
```

No Redis, no queue, no worker in baseline Compose.

## Port cheat sheet (host machine)

| Port | Baseline profile | Optimized profile |
| --- | --- | --- |
| **3000** | Monolith API | Edge API (same URLs, different backend) |
| **3307** | MySQL | MySQL |
| **6379** | — | Redis |
| **9324** | — | ElasticMQ (SQS) |

## Browser on http://127.0.0.1:3000

There is **no HTML homepage**. Hitting `/` used to show `Cannot GET /`; after rebuild, `/` returns a small JSON hint.

Useful URLs in the browser:

- [http://127.0.0.1:3000/health/ready](http://127.0.0.1:3000/health/ready) — should show `{"status":"ok"}`
- [http://127.0.0.1:3000/health/live](http://127.0.0.1:3000/health/live)

Search/booking need a JWT — use curl from `npm run compose:optimized` output or `npm run mint:jwt`.

## Commands

```bash
npm run compose:status      # what is running right now
npm run compose:baseline    # monolith profile
npm run compose:optimized   # split profile
```

Stop either:

```bash
docker compose --project-directory infrastructure/compose down
```

## Common mistakes

1. **Standalone `docker run … elasticmq/redis`** then **`compose:optimized`** — container names clash. Let Compose create Redis and ElasticMQ, or remove the standalone containers first.
2. **Switch `.env` without stopping the old API** — `compose down` with `COMPOSE_PROFILES=optimized` does not remove `railflux-baseline`. Stop/remove it before starting the other profile.
3. **Pasting curl with `# comment`** in zsh — run curl on its own line.

See also [infrastructure/compose/README.md](../infrastructure/compose/README.md).
