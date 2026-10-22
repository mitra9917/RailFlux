# Infrastructure scripts

AWS and Compose helpers under `infrastructure/`. Compose scripts live in repo-root `scripts/` for historical paths.

## CloudFormation (M5 #41)

| Script | Purpose |
| --- | --- |
| `cfn-validate.sh` | Structural checks + optional `aws cloudformation validate-template` |
| `cfn-lib.sh` | Shared regions, stack names, tags (sourced by other scripts) |
| `aws-deploy.sh` | Deploy `aws-baseline`, `aws-optimized`, or `aws-edge-waf` root stack |
| `aws-run-manifest.mjs` | Parse run manifest for deploy preflight (M5 #52) |
| `aws-deploy-preflight.sh` | Manifest + `cfn:validate` + AWS identity + budget stack check |
| `aws-deploy-session.sh` | Full module order from deployment runbook (`--dry-run` default) |
| `aws-deploy-module.sh` | Deploy `network`, `iam`, `rds`, `rds-replica`, `elasticache`, `alb-*`, `ecs-*`, or `cloudfront-*` module |
| `aws-rds-migrate-smoke.sh` | Baseline smoke — connect to RDS and run `migrate.sh` (M5 #43) |
| `aws-ecs-alb-smoke.sh` | Wait for ALB target group healthy (M5 #46) |
| `aws-sqs-worker-smoke.sh` | SQS/DLQ + worker ECS smoke (M5 #49) |
| `aws-observability-smoke.sh` | Dashboard + alarms smoke (M5 #50) |
| `aws-account-budgets-smoke.sh` | Account budget notifications (M5 #51) |
| `aws-teardown.sh` | Delete session stacks (`--profile all` checks both regions) |
| `aws-teardown-session.sh` | Runbook teardown order + orphan audit (`--dry-run` default, M5 #53) |
| `aws-orphan-audit.sh` | Scan `ap-south-1` + `us-east-1`; fail if paid RailFlux orphans remain |
| `aws-orphan-audit.mjs` | Orphan audit logic (also imported by tests) |
| `aws-security-st004-smoke.sh` | ST-004 ALB origin header restriction |
| `aws-security-st005-smoke.sh` / `aws-security-st005.mjs` | ST-005 IAM negative simulation |
| `aws-security-smoke.sh` | ST-004 + ST-005 with JSON evidence (M5 #54) |
| `aws-package.sh` | Package nested templates to S3 (for future nested-stack deploys) |

Default application region: **`ap-south-1`**. CloudFront WAF edge stack: **`us-east-1`**.

Run from repository root via `npm run cfn:validate` and `npm run aws:deploy:*`.

## AWS login (CLI vs Cursor MCP)

Two different auth paths:

| Path | Used for | RailFlux account |
| --- | --- | --- |
| **Cursor AWS MCP** (`.cursor/mcp.json` → OAuth) | Agent `aws___run_script` in chat | **856073125851** — already works when MCP shows **ready** |
| **AWS CLI profile `railflux`** | `npm run aws:deploy:*`, your terminal | Same account, IAM user **`railflux-cli`** |

Deploy scripts auto-set **`AWS_PROFILE=railflux`** and **`AWS_DEFAULT_REGION=ap-south-1`** via `aws-env.sh` (override with `RAILFLUX_AWS_PROFILE`).

Verify CLI before deploy:

```bash
export AWS_PROFILE=railflux
aws sts get-caller-identity
# Account should be 856073125851
```

If MCP shows **needs auth** in Cursor: **Settings → MCP → aws → Sign in / Reconnect** (OAuth to AWS MCP, not the same as CLI keys).

Do not use the `[default]` CLI profile for RailFlux—those access keys are often expired; use **`railflux`** only.
