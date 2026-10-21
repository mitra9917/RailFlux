# aws-optimized CloudFormation

Root: **`root.yaml`** — deploy with `npm run aws:deploy:optimized`.

Adds replica, Redis, SQS/DLQ, and split ECS services on top of shared modules. See [../README.md](../README.md).

Read replica: **`rds-replica.yaml`** + [db-routing.md](db-routing.md) (booking → primary, read → replica).

ElastiCache: **`elasticache.yaml`** + [elasticache-test-window.md](elasticache-test-window.md) (read-path `REDIS_URL` only).
