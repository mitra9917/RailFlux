# Two-Person Work Plan

Use ownership for speed but require cross-review on correctness and experiments.

## Contributor A: transaction and data lead

- schema, migrations, fixture generation;
- booking state machine, atomic claim, idempotency, payment stub;
- outbox and reconciliation SQL;
- RDS/ElastiCache/SQS infrastructure modules;
- database/queue failure tests.

## Contributor B: experience and experiment lead

- React workflow and API client;
- search/read service and cache behavior;
- k6 cohorts, open workloads, run manifests;
- telemetry normalization, dashboards, analysis;
- CloudFront/WAF/ALB/ECS and frontend infrastructure.

## Shared work

- API contract and ADR changes;
- IAM/security review;
- cost preflight and teardown;
- principal experiment execution;
- results interpretation and final presentation.

## Review rules

- No booking/transaction change merges without the other contributor reviewing invariants and concurrency tests.
- No experiment-script change merges without verifying offered/started/dropped accounting.
- No AWS stack deploys without a second-person cost/expiry check.
- The person who did not run a campaign performs its artifact and reconciliation audit.

## Weekly handoff

Each week record:

- completed acceptance gates;
- changed assumptions/ADRs;
- unresolved blockers;
- current AWS spend;
- next owner and exact reproducible starting command.
