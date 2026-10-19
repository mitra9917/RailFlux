# Infrastructure

Local Docker Compose (M2+) and AWS CloudFormation (M5).

| Path | Purpose |
| --- | --- |
| `compose/` | Docker Compose — MySQL + `baseline` profile (API + auto fixture load); see [compose/README.md](compose/README.md) |
| `cloudformation/shared/` | Networking, IAM patterns, shared parameters |
| `cloudformation/baseline/` | Baseline stack modules |
| `cloudformation/optimized/` | Optimized stack modules (Redis, replica, SQS, worker) |
| `scripts/` | Deploy, smoke, and teardown wrappers matching docs runbooks |

Region default: `ap-south-1` (CloudFront/WAF edge exceptions documented in architecture docs).
