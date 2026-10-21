# Optimized AWS database routing (M5 #44)

| Service | `MYSQL_HOST` source | Authoritative for booking? |
| --- | --- | --- |
| **read** | `DbReplicaEndpointAddress` from **rds-replica** stack; optional `REDIS_URL` from **elasticache** stack | No — advisory reads only |
| **booking** | `DbEndpointAddress` from **rds** (primary) stack | Yes — inventory + commits |
| **worker** | Primary (same secret as booking) | Side-effect dedupe on primary |

CloudFormation does not auto-wire ECS environment variables until the ECS modules land (M5 P3). At deploy time:

1. `npm run aws:deploy:rds -- --session SESSION …`
2. `npm run aws:deploy:rds-replica -- --session SESSION …` (optimized sessions only)
3. When defining task definitions, set **read** tasks to the replica endpoint and **booking** tasks to the primary endpoint from stack outputs.

Replica lag is expected; booking must never use the replica endpoint (see [project charter](../../../docs/project-charter.md)).
