# Deployment Runbook

CloudFormation **layout stubs** and wrapper scripts ship in M5 #41 (`infrastructure/cloudformation/`, `infrastructure/scripts/aws-deploy.sh`). Full modules (VPC, RDS, ECS) land in follow-on M5 issues—do not deploy paid resources beyond empty root stacks until those modules exist unless you accept placeholder-only stacks.

```bash
npm run cfn:validate
npm run aws:deploy:baseline -- --session SESSION --expires-at 2026-12-31T23:59:59Z --owner YOU --run-id RUN_ID
```

## Preflight

1. Confirm Billing credit/Free Tier status.
2. Check month-to-date and forecast cost.
3. Confirm alerts at $10/$25/$50/$75.
4. Complete a session estimate and set `ExpiresAt`.
5. Confirm profile, region, image digests, fixture, owner, and teardown window.
6. Confirm no other RailFlux paid profile is active.
7. Validate CloudFormation templates and IAM changes.

## Deploy

1. Deploy shared budget/artifact/ECR resources if absent.
2. Build immutable images and record digests.
3. Deploy network, RDS primary, and IAM (`npm run aws:deploy:network`, then `aws:deploy:rds`, then `aws:deploy:iam`). Verify schema with `npm run aws:smoke:rds-migrate -- --session SESSION`.
4. For optimized sessions only, deploy queue/DLQ; omit them from the Stage 1 baseline smoke profile.
5. Deploy RDS, migrate schema, restore fixture, and record checksum.
6. For optimized sessions only, deploy read replica (`npm run aws:deploy:rds-replica`) and ElastiCache (`npm run aws:deploy:elasticache`). Record cache class and `expires_at` in the run manifest ([elasticache-test-window.md](../../infrastructure/cloudformation/optimized/elasticache-test-window.md)). Wire **read** tasks to replica + `REDIS_URL`; **booking** stays on primary ([db-routing.md](../../infrastructure/cloudformation/optimized/db-routing.md)).
7. Deploy ECS task definitions/services and ALB routing.
8. Deploy private S3/CloudFront frontend.
9. Enable WAF only for sessions that require it.
10. Deploy minimal dashboard/alarms and log retention.

## Validate

- CloudFormation stack events are successful.
- No public RDS/Redis endpoint exists.
- Direct ALB requests without origin restriction fail.
- Health/readiness endpoints pass.
- Task roles pass positive and negative permission checks.
- Fixture/reset checks pass.
- Queue/DLQ are empty.
- CloudFront `/api/*` origin points to the current profile’s ALB and `/api/v1/*` routing passes.
- WAF mode exactly matches the paired cell: off for principal legitimate-only cells and the same frozen rules for both mixed-cohort profiles.
- `ExpiresAt` and `RunId` tags exist.
- Cost estimate still matches actual resources.

## Handoff

Write endpoints and resource IDs into the run manifest. Never paste credentials into the manifest or chat.
