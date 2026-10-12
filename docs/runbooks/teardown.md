# Teardown and Cost-Audit Runbook

## Normal teardown

1. Stop load generation and wait for bounded artifact export.
2. Export reconciliation, metrics, traces, run manifests, and stack outputs.
3. Delete optimized-only resources first: workers, read service, ElastiCache, read replica.
4. Delete ECS services/task definitions as managed by the stack.
5. Delete CloudFront/WAF/frontend resources if not required for the next scheduled session.
6. Delete ALB, listeners, target groups, and associated public IPv4 usage.
7. Snapshot RDS only when evidence/recovery requires it; otherwise delete it with the profile.
8. Delete stack-created log groups/artifacts according to retention policy.
9. Delete network stack after dependent ENIs are gone.

## Audit for orphans

Check every relevant region for:

- running/pending ECS tasks and services;
- ALBs, target groups, and ENIs;
- RDS instances, read replicas, and snapshots;
- ElastiCache clusters;
- NAT Gateways, EIPs, and public IPv4 allocations;
- EC2 load generators;
- WAF ACLs/rule groups/log destinations;
- CloudWatch log groups, alarms, dashboards, and Container Insights;
- ECR images, S3 objects, Secrets Manager secrets;
- CloudFormation stacks in failed/delete-failed states.

Always inspect both `ap-south-1` and `us-east-1`. The latter can contain CloudFront-scoped WAF ACLs, WAF log destinations, and CloudFront ACM certificates even though the application runs in Mumbai.

If CloudFront is intentionally retained while its ALB is deleted, mark the distribution origin stale and block further experiment traffic until the next deployment updates and validates the origin.

## Emergency teardown order

1. Scale ECS to zero to stop immediate compute growth.
2. Delete load generator and optimized replica/cache.
3. Delete ALB/WAF.
4. Export only essential evidence.
5. Delete application/data stacks.
6. Investigate delete failures and dependent ENIs.

Scaling ECS to zero alone does not stop ALB, RDS, cache, IPv4, log, or storage charges.

## Final verification

- CloudFormation lists no active RailFlux session stack.
- Cost Explorer/resource inventory shows no unexpected RailFlux resource.
- S3/ECR/snapshots retained intentionally are documented with estimated storage cost.
- Month-to-date cost and forecast are recorded.
- The run manifest contains teardown timestamp and auditor.
