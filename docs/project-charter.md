# Project Charter

## Purpose

Build and evaluate a small but correct railway booking simulator that exposes the architectural effects of caching, workload isolation, queueing, autoscaling, and admission controls during a synchronized sale.

## Stakeholders

- Student team: architecture, implementation, experiments, and report
- Faculty/evaluators: requirements, syllabus alignment, and evidence review
- Test participants: synthetic identities only
- AWS account owner: budget, security, and teardown accountability

## Objectives

1. Preserve booking correctness under contention and retries.
2. Establish a transparent, intentionally simple baseline.
3. Build an optimized AWS reference architecture.
4. Generate a realistic non-stationary burst with legitimate and bot-like cohorts.
5. Compare systems using reproducible paired runs.
6. Explain trade-offs with measured performance and cost.
7. Keep total AWS spend materially below the $200 credit allocation.

## Deliverables

- working local baseline and optimized modes;
- ephemeral CloudFormation deployment profiles;
- versioned APIs, schema, fixtures, and run manifests;
- a CLI experiment controller for deploy/reset/k6/export/reconcile orchestration;
- load, resilience, security, and correctness tests;
- raw and normalized experiment results;
- comparison analysis and presentation;
- complete architecture and operations documentation.

## Success criteria

- Zero observed oversell and duplicate charges across all accepted runs.
- A deterministic workload can be replayed from its seed and fixture checksum.
- All principal experiment cells have at least five valid paired repetitions.
- Generator saturation and state-reset checks pass.
- Performance and cost conclusions include uncertainty and limitations.
- Emergency teardown is tested before full experiments.

## Constraints

- AWS Free Tier/credits and a $100 stop-and-review threshold.
- Six-week implementation target.
- Two contributors.
- Single AWS application region (`ap-south-1`).
- Synthetic data and mocked external integrations only.
- Single-component failure injection only.

## Non-negotiable decisions

- “IRCTC architecture” is not used as the baseline label.
- Booking decisions use the primary database, never cache or replica data.
- The primary comparison is sequential, isolated, randomized, and paired.
- Open arrival-rate workloads are primary for burst capacity.
- A booking is measured to a terminal outcome, not merely HTTP acceptance.
- No paid resource is provisioned without a teardown path and session limit.

## Governance

- Architecture changes require an ADR.
- Experiment changes after confirmatory runs begin require a protocol amendment.
- Failed correctness checks invalidate the run.
- Unexpected spend pauses provisioning until reviewed.
- Results and exclusions are append-only once published.
