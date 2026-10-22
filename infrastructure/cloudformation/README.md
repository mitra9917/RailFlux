# CloudFormation layout (M5)

RailFlux AWS profiles mirror [system overview](../../docs/architecture/system-overview.md):

| Profile | Stack root | Application region | Compute shape |
| --- | --- | --- | --- |
| `aws-baseline` | `baseline/root.yaml` | `ap-south-1` | ALB + monolith Fargate + Single-AZ RDS |
| `aws-optimized` | `optimized/root.yaml` | `ap-south-1` | ALB + split Fargate + RDS primary/replica + ElastiCache + SQS/DLQ + worker |

Only one paid profile should be deployed at a time. Session tags (`RunId`, `Owner`, `ExpiresAt`) are required parameters on every root deploy.

## Directory map

| Path | Role |
| --- | --- |
| `shared/network.yaml` | VPC, subnets, routes, security groups (**M5 #42**) |
| `shared/iam-task-roles.yaml` | ECS execution + per-service task roles (**M5 #42**) |
| `shared/iam-matrix.md` | ST-005 prep — queue access matrix |
| `shared/account-budgets.yaml` | AWS Budgets $10/$25/$50/$75 + anomaly email (**M5 #51**) |
| `shared/session-bootstrap.yaml` | ECR/artifact buckets stub (M5 P5); budgets → account-budgets |
| `shared/rds-primary.yaml` | Single-AZ MySQL primary (**M5 #43**) |
| `baseline/ecs-monolith.yaml` | Baseline Fargate monolith (**M5 #46**, attaches to ALB TG from #47) |
| `shared/alb-ingress.yaml` | ALB HTTPS + origin header + WAF hooks (**M5 #47**) |
| `optimized/rds-replica.yaml` | Read replica (**M5 #44**, optimized only) |
| `optimized/elasticache.yaml` | Redis test window (**M5 #45**) |
| `optimized/sqs-worker.yaml` | Side-effects SQS + DLQ (**M5 #49**) |
| `optimized/ecs-services.yaml` | Read, booking, edge Fargate (**M5 #46**, edge TG from #47) |
| `shared/cloudfront-oac.yaml` | Private S3 + CloudFront OAC + `/api/*` → ALB (**M5 #48**) |
| `shared/observability.yaml` | Dashboard, SLO metric filters, alarms, OTEL hooks (**M5 #50**) |
| `edge/waf.yaml` | **CloudFront-scoped WAF** (see below) |

Module templates ship as **layout stubs** in M5 #41; nested resources land in follow-on issues. Root stacks record the planned module order in `Metadata.RailFlux.PlannedNestedStacks`.

## Regions and edge (WAF)

Per [network-deployment.md](../../docs/architecture/network-deployment.md):

- **Application stacks** deploy to **`ap-south-1`** (Mumbai).
- **CloudFront** is global; distributions are created from templates that reference origins in `ap-south-1`.
- **WAF web ACLs attached to CloudFront** must be created in **`us-east-1`** (N. Virginia). This is an AWS constraint, not an application failover region.

Deploy edge WAF separately when a session manifest enables WAF:

```bash
./infrastructure/scripts/aws-deploy.sh aws-edge-waf --session "$SESSION" ...
```

Teardown must delete **`ap-south-1` application stacks first**, then **`us-east-1` edge** stacks if present. See [edge/README.md](edge/README.md) and [teardown runbook](../../docs/runbooks/teardown.md).

## Wrapper scripts

From repository root:

| Command | Purpose |
| --- | --- |
| `npm run cfn:validate` | Structural + optional AWS CLI template validation |
| `npm run aws:deploy:account-budgets` | One-time account budget alerts (us-east-1, `--budget-alert-email`) |
| `npm run aws:smoke:account-budgets` | Verify budget stack after deploy |
| `npm run aws:deploy:baseline` | Deploy `aws-baseline` root (pass `--session`, tags) |
| `npm run aws:deploy:optimized` | Deploy `aws-optimized` root |
| `npm run aws:deploy:edge-waf` | Deploy CloudFront WAF in `us-east-1` (**M5 #47**) |
| `npm run aws:deploy:alb-baseline` | ALB HTTPS + origin header (baseline) |
| `npm run aws:deploy:alb-optimized` | ALB HTTPS + origin header (optimized edge TG) |
| `npm run aws:deploy:ecs-baseline` | Fargate monolith (requires alb-baseline) |
| `npm run aws:deploy:ecs-optimized` | Split Fargate services (requires alb-optimized) |
| `npm run aws:smoke:ecs-alb` | Wait for ALB target group healthy |
| `npm run aws:deploy:cloudfront-baseline` | S3 + CloudFront (requires alb-baseline) |
| `npm run aws:deploy:cloudfront-optimized` | S3 + CloudFront (requires alb-optimized) |
| `npm run aws:deploy:observability` | CloudWatch dashboard + SLO alarms (after ECS) |
| `npm run aws:smoke:observability` | Verify dashboard and session alarms |
| `npm run aws:deploy:network` | VPC + security groups for a session |
| `npm run aws:deploy:iam` | Task roles (pass `--deployment-profile`) |
| `npm run aws:deploy:rds` | RDS primary (requires network stack) |
| `npm run aws:smoke:rds-migrate` | Run migrations against session RDS |
| `npm run aws:deploy:rds-replica` | Read replica (after primary; optimized) |
| `npm run aws:deploy:elasticache` | ElastiCache Redis (optimized test window) |
| `npm run aws:deploy:sqs-worker` | SQS + DLQ (optimized; before IAM SQS policies) |
| `npm run aws:smoke:sqs-worker` | Queue + worker service presence check |
| `npm run aws:teardown` | Delete session stacks (profile + region aware) |
| `npm run aws:teardown:session` | Full session teardown + orphan audit (dry-run default) |
| `npm run aws:audit:orphans` | Post-smoke account audit (`ap-south-1` + `us-east-1`) |
| `npm run aws:smoke:security` | ST-004 + ST-005 with evidence JSON (M5 #54) |

See [infrastructure/scripts/README.md](../scripts/README.md).

## Parameters

Copy [parameters/session.example.json](parameters/session.example.json) and pass overrides to `aws-deploy.sh`, or use CLI flags documented in the deploy script.

Nested stack packaging (S3 `TemplateURL`) is required before modules reference each other in AWS; `aws-package.sh` documents the bucket workflow for M5 P5 automation.
