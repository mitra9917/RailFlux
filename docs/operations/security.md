# Security and Abuse-Resistance Design

## Threat model

Protected assets:

- booking inventory integrity;
- synthetic user/session identifiers;
- database credentials and task-role permissions;
- experiment results and audit evidence;
- AWS credits and resource quotas.

Principal threats:

- injection and malformed payloads;
- credential stuffing or concentrated synthetic accounts;
- high-rate polling and retry amplification;
- duplicate booking/charge attempts;
- direct ALB-origin bypass;
- leaked secrets or overprivileged roles;
- public database/cache exposure;
- denial of wallet through unconstrained resources/logging.

## Controls

### Edge

- CloudFront HTTPS only.
- Private S3 origin with Origin Access Control and Block Public Access.
- CloudFront WAF ACL with AWS core managed rules plus a small rate-based rule.
- No paid Bot Control managed group.
- ALB restricted to CloudFront origin-facing addresses and a rotated secret origin header.

### Application

- Strict JSON schema validation and body-size limits.
- Parameterized SQL only.
- UUID/enum/date validation and passenger-count constraints.
- Idempotency required for booking.
- Bounded retries with jitter; no recursive application retry storms.
- Separate rate classes for reads and writes.
- Generic client errors and structured internal diagnostics.

### Identity and secrets

- Synthetic JWT identities for the demo; no real Aadhaar or personal data.
- Separate ECS task roles for baseline/API, booking publisher, read service, worker, and deployment.
- Secrets Manager only for actual secrets; non-secret configuration in environment/SSM parameters.
- No long-lived AWS keys in containers or repository.
- ECR image scanning and pinned base-image digests.

### Data and network

- RDS and ElastiCache private and SG-restricted.
- TLS to ALB and managed AWS endpoints; database TLS enabled.
- Encryption at rest using AWS-managed keys unless coursework requires a CMK.
- Backups and result buckets block public access.
- Logs hash idempotency keys and omit passenger/payment payloads.

## WAF experiment

Bot-like traffic uses owned synthetic identities and configurable request concentration. Measure:

- allowed, challenged if configured, rate-limited, and blocked requests;
- legitimate false-positive rate;
- backend request reduction;
- legitimate completion under mixed load.

WAF is not used to claim sophisticated human/bot classification.

## Cost-security controls

- AWS Budgets and Cost Anomaly Detection.
- Service quotas and conservative autoscaling maxima.
- Resource tags: `Project`, `Owner`, `RunId`, `Profile`, `ExpiresAt`.
- No wildcard task-role actions except where an AWS API cannot be scoped further.
- CloudTrail management events; avoid costly data events unless specifically tested.
- Automatic expiry/teardown and an emergency destroy procedure.

## Ethical test boundary

Load and abuse tests target only RailFlux resources. They do not scrape, probe, authenticate to, or send traffic to IRCTC or any third party.
