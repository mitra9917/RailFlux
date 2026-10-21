# ElastiCache test-window (M5 #45)

Per [cost-plan.md](../../../docs/operations/cost-plan.md) Stage 3: deploy Redis **only** for optimized measurement sessions, then tear down with the session.

## Run manifest alignment

When ElastiCache is provisioned, record in [run-manifest.template.yaml](../../../experiment/run-manifest.template.yaml):

| Manifest field | Source |
| --- | --- |
| `resources.cache_class` | Stack parameter / output `CacheNodeType` (e.g. `cache.t4g.micro`) |
| `cost.expires_at` | Same ISO8601 value as deploy `--expires-at` and CFN tag `ExpiresAt` |
| `cost.maximum_session_hours` | Planned cap from session estimate |
| `cost.estimated_hourly_usd` | Include ElastiCache node in session cost worksheet |
| `architecture` | `optimized` when cache is in use |

Baseline runs keep `resources.cache_class: none`.

## Deploy / teardown

```bash
npm run aws:deploy:elasticache -- --session SESSION --expires-at ISO8601 --owner OWNER
```

Read service: set `REDIS_URL` from stack output `RedisUrl` (see [db-routing.md](db-routing.md) — cache is read-path only).

Teardown: `npm run aws:teardown -- --profile modules --session SESSION` (deletes `railflux-elasticache-*` before network).
