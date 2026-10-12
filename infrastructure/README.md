# Infrastructure

Local Docker Compose (M2+) and AWS CloudFormation (M5).

| Path | Purpose |
| --- | --- |
| `compose/` | Docker Compose files and env templates for baseline/optimized profiles |
| `cloudformation/shared/` | Networking, IAM patterns, shared parameters |
| `cloudformation/baseline/` | Baseline stack modules |
| `cloudformation/optimized/` | Optimized stack modules (Redis, replica, SQS, worker) |
| `scripts/` | Deploy, smoke, and teardown wrappers matching docs runbooks |

Region default: `ap-south-1` (CloudFront/WAF edge exceptions documented in architecture docs).
