# Documentation Index

## Start here

- [README](../README.md)
- [Project description](../PROJECT_DESCRIPTION.md)
- [Project charter](project-charter.md)
- [Roadmap](roadmap.md)
- [Implementation plan](implementation-plan.md)
- [M1 acceptance gate](milestones/M1-acceptance.md)
- [M2 acceptance gate](milestones/M2-acceptance.md)
- [M3 acceptance gate](milestones/M3-acceptance.md)
- [M4 acceptance gate](milestones/M4-acceptance.md)
- [M7 acceptance gate](milestones/M7-acceptance.md)
- [Definition of Done](definition-of-done.md)
- [Requirements traceability](requirements-traceability.md)

## Evidence and boundaries

- [Public IRCTC evidence](research/irctc-public-evidence.md)
- [Assumptions and limitations](assumptions-and-limitations.md)
- [Glossary](glossary.md)

## Architecture

- [Unified system](architecture/system-overview.md)
- [Baseline](architecture/baseline.md)
- [Optimized AWS](architecture/optimized.md)
- [Network and deployment](architecture/network-deployment.md)
- [Request and failure flows](architecture/request-flows.md)
- [Architecture decisions](decisions/architecture-decisions.md)

## Detailed design

- [OpenAPI v1 contract](design/api-spec.yaml)
- [Data and consistency](design/data-consistency.md)
- [Cache and queue](design/cache-and-queue.md)

## Security and operations

- [Security](operations/security.md)
- [Observability and SLOs](operations/observability.md)
- [Cost plan](operations/cost-plan.md)
- [Deployment runbook](runbooks/deployment.md)
- [Experiment runbook](runbooks/experiment.md)
- [Teardown runbook](runbooks/teardown.md)
- [Security smoke runbook](runbooks/security-smoke.md)
- [M5 acceptance gate](runbooks/m5-gate.md)
- [PT-001 k6 smoke](runbooks/pt-001-smoke.md)
- [PT-002 calibration](runbooks/pt-002-calibration.md)
- [Principal paired campaign](runbooks/principal-campaign.md)
- [Failure test campaign](runbooks/failure-campaign.md)
- [Paired bootstrap analysis](runbooks/paired-analysis.md)
- [Results dashboard](runbooks/results-dashboard.md)
- [Experiment report generator](runbooks/experiment-report.md)
- [Second-contributor reproducibility walkthrough](runbooks/reproducibility-walkthrough.md)
- [M7 acceptance gate](runbooks/m7-gate.md)
- [PT-005 / PT-006 from manifest](runbooks/load-from-manifest.md)

## Experiment

- [Protocol](../experiment/protocol.md)
- [Workload model](../experiment/workload-model.md)
- [Test catalog](../experiment/test-catalog.md)
- [Hypotheses](../experiment/hypotheses.yaml)
- [Fixture manifest](../experiment/fixtures/manifest.yaml)
- [Run-manifest template](../experiment/run-manifest.template.yaml)
- [Result JSON Schema](../experiment/result.schema.json)
- [Correctness SQL](../experiment/correctness.sql)
- [Report template](../experiment/report-template.md)

## Delivery

- [Two-person work plan](team-workplan.md)
- [Risk register](risks.md)

## Repository code (scaffold)

- [Shared API types (`@railflux/shared`)](../packages/shared/README.md)
- [Services](../services/README.md)
- [Database](../database/README.md)
- [Infrastructure](../infrastructure/README.md)
- [Load tests](../load-tests/README.md)
- [Frontend](../frontend/README.md) (M8)
- [Experiment controller](../experiment/controller/README.md)
- [Run manifest generator](runbooks/run-manifest-generator.md)
- [Experiment result export](runbooks/export-result.md)
- [Load generator preflight](runbooks/generator-preflight.md)
- [M6 acceptance gate](runbooks/m6-gate.md)
