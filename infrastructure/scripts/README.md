# Infrastructure scripts

AWS and Compose helpers under `infrastructure/`. Compose scripts live in repo-root `scripts/` for historical paths.

## CloudFormation (M5 #41)

| Script | Purpose |
| --- | --- |
| `cfn-validate.sh` | Structural checks + optional `aws cloudformation validate-template` |
| `cfn-lib.sh` | Shared regions, stack names, tags (sourced by other scripts) |
| `aws-deploy.sh` | Deploy `aws-baseline`, `aws-optimized`, or `aws-edge-waf` root stack |
| `aws-deploy-module.sh` | Deploy `network`, `iam`, `rds`, `rds-replica`, `elasticache`, `alb-*`, `ecs-*`, or `cloudfront-*` module |
| `aws-rds-migrate-smoke.sh` | Baseline smoke — connect to RDS and run `migrate.sh` (M5 #43) |
| `aws-ecs-alb-smoke.sh` | Wait for ALB target group healthy (M5 #46) |
| `aws-teardown.sh` | Delete session stacks (`--profile all` checks both regions) |
| `aws-package.sh` | Package nested templates to S3 (for future nested-stack deploys) |

Default application region: **`ap-south-1`**. CloudFront WAF edge stack: **`us-east-1`**.

Run from repository root via `npm run cfn:validate` and `npm run aws:deploy:*`.
