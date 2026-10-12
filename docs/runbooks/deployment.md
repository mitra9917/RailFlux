# Deployment Runbook

Commands remain placeholders until CloudFormation implementation exists. Do not deploy manually around missing IaC.

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
3. Deploy network and security groups.
4. For optimized sessions only, deploy queue/DLQ; omit them from the Stage 1 baseline smoke profile.
5. Deploy RDS, migrate schema, restore fixture, and record checksum.
6. For optimized sessions only, deploy read replica and ElastiCache.
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
