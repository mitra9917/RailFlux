# Security smoke (ST-004 / ST-005)

M5 **#54** — run after ALB and (for optimized) SQS/IAM stacks are deployed.

## Prerequisites

- CLI profile **`railflux`** (`aws sts get-caller-identity`).
- **`ORIGIN_HEADER_VALUE`** — same secret passed to `alb-*` deploy (`--origin-header-value`).
- Healthy targets (`npm run aws:smoke:ecs-alb -- --profile … --session SESSION`).

## Commands

```bash
export ORIGIN_HEADER_VALUE='your-deploy-secret'

# Full run + JSON evidence under experiment/artifacts/security-smoke/
npm run aws:smoke:security -- --profile aws-optimized --session SESSION

# Individual tests
npm run aws:smoke:security-st004 -- --profile aws-optimized --session SESSION
npm run aws:smoke:security-st005 -- --session SESSION --deployment-profile aws-optimized
```

Baseline profile: use `--profile aws-baseline` and `--deployment-profile aws-baseline` for ST-005 monolith checks.

## Evidence (acceptance)

Attach to the smoke run manifest / artifact bundle:

| File | Content |
| --- | --- |
| `st004-SESSION.json` | HTTP status without vs with origin header |
| `st005-SESSION.json` | IAM `SimulatePrincipalPolicy` results per role |
| `security-smoke-SESSION.json` | Combined pass/fail summary |

Expect **ST-004:** direct `https://ALB/health/ready` → **403**; with `X-RailFlux-Origin-Verify` → **2xx**.

Expect **ST-005:** matrix in [iam-matrix.md](../../infrastructure/cloudformation/shared/iam-matrix.md).
