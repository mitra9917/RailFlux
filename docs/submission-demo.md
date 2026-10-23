# Submission demo (baseline vs optimized)

## One URL for judges

1. **Dual API stack** (baseline :3000 + optimized :3001):

   ```bash
   npm run compare:dual-stack
   MYSQL_HOST=127.0.0.1 MYSQL_PORT=3307 npm run db:load   # if demo user missing
   npm run dev:frontend
   ```

2. Open **http://127.0.0.1:5173/compare** (or `http://localhost:5173/compare`).

3. **Home** → Mint dev JWT → **Compare** tab.

## What to show

| Section | What it proves |
| --- | --- |
| **Paired experiment metrics** | Bar charts: p99 latency, success rate, RPS/$ — baseline (blue) vs optimized (green) |
| **Run side-by-side booking probe** | Paired TC-001: shared warmup, parallel timed Search → Availability (optimized **HIT**) → Book on both stacks |

`compare:dual-stack` applies `docker-compose.compare.yml` (sync outbox on booking, compare probe skips payment sleep) so the live demo favors a fair architecture comparison.

## Use your real experiment numbers (optional)

After a principal campaign:

```bash
cp experiment/dashboard/output/YOUR-CAMPAIGN-dashboard.json frontend/public/comparison-data.json
```

Restart Vite and refresh **Compare**.

## Talk track (30 seconds)

- Top: paired load-test results under Tatkal-like conditions.
- Bottom: same booking test case on monolith vs split/cache/queue architecture live.
- We compare **our** baseline reference design to **our** optimized design, calibrated against public IRCTC event shape — not IRCTC internals.
