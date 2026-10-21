# Shared CloudFormation modules

Cross-profile modules referenced from both `baseline/root.yaml` and `optimized/root.yaml`.

| Module | Issue | Deploy |
| --- | --- | --- |
| `network.yaml` | M5 #42 | `npm run aws:deploy:network -- --session … --expires-at …` |
| `iam-task-roles.yaml` | M5 #42 | `npm run aws:deploy:iam -- --session … --deployment-profile aws-optimized …` |
| `rds-primary.yaml` | M5 #43 | `npm run aws:deploy:rds -- --session … --expires-at …` (after network) |
| `session-bootstrap.yaml` | M5 P4/P5 | (upcoming) |

Deploy order for database smoke: **network → rds → iam** (IAM picks up `DbMasterSecretArn` from the RDS stack when omitted). Then `npm run aws:smoke:rds-migrate -- --session …`.

See [iam-matrix.md](iam-matrix.md) for ST-005 queue access rules.
