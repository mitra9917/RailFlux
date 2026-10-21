# IAM task roles and ST-005 prep (M5 #42)

Template: **`iam-task-roles.yaml`**. Network SG matrix: **`network.yaml`** + [network-deployment.md](../../../docs/architecture/network-deployment.md).

## Task roles

| Role | Profile | CloudWatch logs | Secrets (DB) | SQS side-effects queue | SQS DLQ |
| --- | --- | --- | --- | --- | --- |
| `task-monolith` | aws-baseline | yes | optional | **none** | **none** |
| `task-read` | aws-optimized | yes | optional | **none** | **none** |
| `task-edge` | aws-optimized | yes | **none** | **none** | **none** |
| `task-booking` | aws-optimized | yes | optional | **SendMessage**, GetQueueAttributes | **none** |
| `task-worker` | aws-optimized | yes | optional | **Receive**, Delete, ChangeVisibility, GetQueueAttributes | Receive, GetQueueAttributes (inspect) |

## ST-005 negative expectations (M5 #54 smoke)

Using the deployed role ARNs, AWS API calls **must fail** when:

- **Read** or **edge** task role calls `sqs:SendMessage`, `sqs:ReceiveMessage`, or `sqs:DeleteMessage` on the side-effects queue.
- **Booking** role calls `sqs:ReceiveMessage` on the side-effects queue (no consumer access).
- **Worker** role calls `sqs:SendMessage` on the side-effects queue (no publisher access).
- **Baseline monolith** calls any SQS API (baseline AWS smoke has no queue path).

## Security groups (same session VPC)

| SG | Inbound | Outbound |
| --- | --- | --- |
| ALB | 443 from CloudFront origin-facing prefix list | App port → ECS SG |
| ECS | App port from ALB SG | 443 (0.0.0.0/0), 3306 → RDS SG, 6379 → Redis SG |
| RDS | 3306 from ECS SG | (default) |
| Redis | 6379 from ECS SG | (default) |

SQS is reached over HTTPS from ECS tasks in public subnets; authorization is **IAM**, not security groups.
