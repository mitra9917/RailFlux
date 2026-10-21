# Deployment Runbook

CloudFormation **layout stubs** and wrapper scripts ship in M5 #41 (`infrastructure/cloudformation/`, `infrastructure/scripts/aws-deploy.sh`). Full modules (VPC, RDS, ECS) land in follow-on M5 issues—do not deploy paid resources beyond empty root stacks until those modules exist unless you accept placeholder-only stacks.

```bash
# Copy and fill experiment/run-manifest.template.yaml (deployment.session_name, cost.expires_at, …)
npm run aws:deploy:preflight -- --manifest experiment/my-run.yaml
npm run aws:deploy:session -- --manifest experiment/my-run.yaml          # dry-run plan
npm run aws:deploy:session -- --manifest experiment/my-run.yaml --execute  # apply (needs env; see script help)
```

Single-module deploys remain available via `npm run aws:deploy:network` and other `aws:deploy:*` scripts.

## Preflight

1. Confirm Billing credit/Free Tier status.
2. Check month-to-date and forecast cost.
3. Confirm alerts at $10/$25/$50/$75.
4. Complete a session estimate and set `ExpiresAt`.
5. Confirm profile, region, image digests, fixture, owner, and teardown window.
6. Confirm no other RailFlux paid profile is active.
7. Validate CloudFormation templates and IAM changes.

## Deploy

1. Deploy account budgets once (`npm run aws:deploy:account-budgets -- --budget-alert-email YOU@example.com`). Confirm email subscription in inbox. Then shared artifact/ECR resources if absent (M5 P5).
2. Build immutable images and record digests.
3. Deploy network, RDS primary, and IAM (`npm run aws:deploy:network`, then `aws:deploy:rds`, then `aws:deploy:iam`). Verify schema with `npm run aws:smoke:rds-migrate -- --session SESSION`.
4. For optimized sessions only, deploy queue/DLQ (`npm run aws:deploy:sqs-worker -- --session SESSION --expires-at …`), then **re-deploy IAM** with `--deployment-profile aws-optimized` so booking/worker task roles receive SQS ARNs. Baseline smoke omits the queue.
5. Deploy RDS, migrate schema, restore fixture, and record checksum.
6. For optimized sessions only, deploy read replica (`npm run aws:deploy:rds-replica`) and ElastiCache (`npm run aws:deploy:elasticache`). Record cache class and `expires_at` in the run manifest ([elasticache-test-window.md](../../infrastructure/cloudformation/optimized/elasticache-test-window.md)). Wire **read** tasks to replica + `REDIS_URL`; **booking** stays on primary ([db-routing.md](../../infrastructure/cloudformation/optimized/db-routing.md)).
7. Deploy ALB ingress (`npm run aws:deploy:alb-baseline` or `aws:deploy:alb-optimized`) with ACM cert and origin verify header. When the manifest sets `waf_mode: on`, deploy edge WAF first (`npm run aws:deploy:edge-waf`), then pass `--waf-mode on` to the ALB module.
8. Deploy ECS task definitions/services wired to the ALB target group (`aws:deploy:ecs-baseline` / `aws:deploy:ecs-optimized`). Optimized deploy requires `--container-image-worker` when the sqs-worker stack exists. Smoke with `npm run aws:smoke:ecs-alb` and `npm run aws:smoke:sqs-worker`.
9. Deploy private S3/CloudFront frontend (`npm run aws:deploy:cloudfront-baseline` or `cloudfront-optimized`) with the same `--origin-header-value` as ALB; pass `--waf-mode on` when the edge WAF stack exists.
10. Deploy observability (`npm run aws:deploy:observability -- --session SESSION --run-id RUN_ID --deployment-profile …`). Re-deploy ECS if it was created before `RunId` was set, so OTEL env is present. Smoke with `npm run aws:smoke:observability`.

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
