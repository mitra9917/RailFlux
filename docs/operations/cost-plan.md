# Cost and Credit Plan

## Guardrails

- Target total project spend: **$40–$70**.
- Stop and review all provisioning at **$100**.
- Preserve at least half of the expected $200 credit envelope.
- Verify current Free Tier/credit eligibility before the first deployment.
- Set AWS Budgets alerts at $10, $25, $50, and $75.
- Enable Cost Anomaly Detection and daily cost review during AWS weeks.

Budget alerts do not stop resources automatically.

## Cost principles

1. Develop locally with Docker Compose.
2. Deploy one architecture at a time.
3. Provision paid resources for scheduled sessions only.
4. Put `ExpiresAt`, `RunId`, `Profile`, `Owner`, and `Project` tags on resources.
5. Record estimated hourly cost and maximum runtime in every run manifest.
6. Export evidence, then tear down immediately.
7. Review Cost Explorer after each session; billing data can lag.

## Service ladder

### Stage 0: local

React, Node services, MySQL, Redis, ElasticMQ, worker, and k6. Expected AWS spend: $0.

### Stage 1: minimal smoke

S3/CloudFront frontend, one ALB, one small baseline Fargate monolith, and one Single-AZ RDS. Run only long enough to verify networking, migration, logs, and teardown; SQS is added with the optimized component stage.

### Stage 2: baseline campaign

Fixed monolith capacity and RDS; WAF only when testing edge behavior. Destroy after results export.

### Stage 3: optimized components

Add split services, ElastiCache, read replica, worker, and autoscaling one at a time. Component smoke tests identify cost/configuration problems before full deployment.

### Stage 4: paired campaign

Run the full optimized profile only for the frozen measurement schedule, then destroy it.

## Minimum AWS campaign envelope

The principal design contains 20 pairs/40 three-minute measured runs. Batch runs inside a small number of sessions so deployment/reset overhead does not become 40 separate provisioning windows.

Planning ceiling:

- baseline smoke + calibration: up to 6 stack-hours;
- baseline principal campaign: up to 10 stack-hours;
- optimized component smoke: up to 4 stack-hours;
- optimized principal campaign: up to 12 stack-hours;
- selected AWS failure reruns: up to 4 stack-hours.

These are maximum runtimes, not prices. Before each stage, use current regional pricing to prove its estimate fits the remaining $40–$70 target. Secondary cells remain local unless the estimate leaves contingency.

## Avoided costs

- no NAT Gateway;
- no API Gateway;
- no RDS Multi-AZ;
- no paid WAF Bot Control/marketplace rules;
- no always-on ElastiCache or read replica;
- no Container Insights initially;
- no AWS Distributed Load Testing solution;
- no custom KMS keys unless required;
- no domain purchase;
- no long log retention.

## Session estimate template

Before deployment record:

```text
profile:
region:
resources and quantities:
estimated hourly cost:
expected build/warm-up hours:
expected measurement hours:
maximum session hours:
estimated data transfer/log ingestion:
expiry timestamp:
owner:
teardown command/runbook:
```

Prices must be refreshed from AWS Pricing Calculator/current service pages. Do not treat old blueprint figures as current.

## Cost fallback order

If spend approaches the stop threshold:

1. stop exploratory and soak tests;
2. use local k6 instead of EC2;
3. shorten WAF/CloudFront demonstration time;
4. reduce repetitions only for secondary cells;
5. preserve correctness, RDS/ECS/SQS, and the principal paired experiment;
6. never weaken isolation or transactional correctness to save cost.

## Emergency response

- Set ECS desired counts to zero only as an immediate pause; this does not stop ALB/RDS/cache hourly spend.
- Export required evidence.
- Delete read replicas and ElastiCache.
- Delete application stacks/ALB/WAF resources.
- Snapshot/delete RDS only if the snapshot is required; snapshots also cost storage.
- Verify orphan ENIs, EIPs/public IPv4, log groups, ECR images, S3 objects, and snapshots.
