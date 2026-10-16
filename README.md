# RailFlux

RailFlux is an academic experiment for studying a Tatkal-like railway booking surge. It compares a deliberately simple legacy-style baseline with an AWS-optimized design under the same deterministic workload.

RailFlux does **not** reproduce IRCTC, NGeT, or CRIS internals. Those systems are proprietary. Public facts are used only to shape a credible workload; all implementation details in this repository are our own reference design.

## Research question

> Under equal correctness constraints and controlled resource/cost budgets, how much does a cloud-native read/write-separated architecture improve SLO-compliant capacity, tail latency, resilience, and legitimate-user success during a synchronized booking burst?

## Systems under test

- **Baseline:** CloudFront → optional, cell-controlled WAF → ALB → fixed-capacity monolith → MySQL primary. Reads, bookings, payment simulation, and side effects share the synchronous path.
- **Optimized:** The same front door routes to independently scalable read and booking services. Redis and an RDS read replica serve non-authoritative reads; the RDS primary remains authoritative for bookings; SQS and workers handle side effects.
- **Experiment engine:** deterministic fixtures, k6 open-model traffic, run orchestration, correctness reconciliation, telemetry normalization, paired analysis, and a results dashboard.

Tests run sequentially against isolated, reset state. Simultaneously mirroring booking requests would consume inventory twice and invalidate the comparison.

## Technology stack

- Frontend: React + Vite
- Services and workers: Node.js + TypeScript + Express
- Database: MySQL 8 locally; Amazon RDS for MySQL on AWS
- Cache: Redis 7 locally; Amazon ElastiCache during optimized test windows
- Queue: ElasticMQ locally; Amazon SQS + DLQ on AWS
- Compute: Docker Compose locally; Amazon ECS on Fargate on AWS
- Edge and ingress: Amazon S3, CloudFront, AWS WAF, Application Load Balancer
- Observability: structured logs, OpenTelemetry, CloudWatch
- Load generation: k6
- Infrastructure as code: AWS CloudFormation
- Region: `ap-south-1` except CloudFront-scoped WAF resources, which are managed in `us-east-1`

## Cost policy

Local development is the default. Paid AWS infrastructure is deployed only for scheduled smoke tests and measurement sessions, then destroyed.

- Target project spend: **$40–$70**
- Stop-and-review threshold: **$100**
- Absolute credit envelope: **$200**, subject to actual account eligibility
- No NAT Gateway, paid Bot Control, Multi-AZ database, or always-on test stack
- ElastiCache, read replica, WAF, ALB, extra tasks, and any EC2 load generator are test-window resources
- Budget alerts: $10, $25, $50, and $75

Credits may exclude taxes, domains, support plans, marketplace products, or particular services. Check Billing before deployment.

## Documentation map

- [Project description](PROJECT_DESCRIPTION.md)
- [Project charter](docs/project-charter.md)
- [Documentation index](docs/INDEX.md)
- [Public IRCTC evidence](docs/research/irctc-public-evidence.md)
- [Assumptions and limitations](docs/assumptions-and-limitations.md)
- [Unified architecture](docs/architecture/system-overview.md)
- [Baseline architecture](docs/architecture/baseline.md)
- [Optimized AWS architecture](docs/architecture/optimized.md)
- [Data and consistency design](docs/design/data-consistency.md)
- [Experiment protocol](experiment/protocol.md)
- [Test catalog](experiment/test-catalog.md)
- [Cost plan](docs/operations/cost-plan.md)
- [Implementation roadmap](docs/roadmap.md)

## Repository layout

```text
packages/
  shared/                 @railflux/shared API types and errors (OpenAPI v1)
frontend/                 React booking simulator (M8)
services/
  baseline/               Monolith API (M2–M3)
  read/                   Optimized read service (M4)
  booking/                Optimized booking service (M4)
  worker/                 Async side-effect consumer (M4)
database/
  migrations/             MySQL DDL
  seeds/                  Fixture load
  scripts/                migrate / seed / reset
infrastructure/
  compose/                Docker Compose profiles (M2+)
  cloudformation/         AWS stacks: shared, baseline, optimized (M5)
  scripts/                deploy and teardown helpers
load-tests/
  k6/                     Performance scripts (M6)
  data/                   k6 fixtures
  results/                Run exports (gitignored)
experiment/               Protocol, schemas, manifests (existing)
  controller/             Experiment CLI (M6)
  runs/                   Per-run JSON artifacts (gitignored)
docs/                     Architecture, design, operations, ADRs
scripts/                  validate-openapi, GitHub bootstrap
```

Each top-level code directory has a `README.md` with scope and milestone hints.

## Developer scripts

From the repository root (Node 20+):

| Command | Action |
| --- | --- |
| `npm run validate:openapi` | Check OpenAPI v1 spec |
| `npm run build:shared` | Build `@railflux/shared` TypeScript types |
| `npm run typecheck:shared` | Typecheck shared package only |
| `./scripts/validate-openapi.sh` | Same as above |
| `./scripts/bootstrap_github_issues.py` | Sync GitHub milestones/issues (optional) |

See [scripts/README.md](scripts/README.md).

## Definition of success

An optimization is accepted only when:

1. no inventory is oversold;
2. no idempotency key creates multiple bookings or charges;
3. inventory and booking records reconcile after every run;
4. the load generator is not the bottleneck;
5. both architectures receive the same seeded offered workload;
6. improvement is reported with repeated-run uncertainty and cost;
7. measured results—not estimates—support the conclusion.

See [Definition of Done](docs/definition-of-done.md) for the complete checklist.
