# Experiment Report: `<pair or campaign ID>`

## Provenance

- Application commit:
- Infrastructure commit:
- Fixture/checksum:
- Request/randomization seeds:
- AWS region:
- Measurement dates:
- Valid/invalid runs:

## Question and frozen hypotheses

Link the exact `hypotheses.yaml` revision. Record protocol amendments.

## Resource and cost parity

State maximum vCPU/memory, database/cache classes, task limits, hourly estimate, and actual attributable cost for each architecture.

## Workload

State the arrival model, offered rates, cohort mix, inventory profile, cache condition, payment sequence, timeouts, and retry policy.

## Validity checks

- Fixture/reset:
- Generator capacity:
- Telemetry completeness:
- Correctness reconciliation:
- Deployment drift:

## Results

For every primary and secondary metric, show each run, the paired effect, median/geometric ratio, paired bootstrap 95% interval, and exact units.

Required:

- offered/started/completed/dropped demand;
- terminal outcome counts;
- p50/p95/p99 terminal latency;
- technical and HTTP error rates;
- legitimate-user success by cohort;
- database/cache/queue/task behavior;
- recovery metrics for failure campaigns;
- actual cost and efficiency.

## Correctness

Report inventory before/after, unique confirmed seats, oversell count, duplicate charge count, outbox gaps, DLQ contents, and unresolved outcomes.

## Interpretation

Separate:

- measured findings;
- plausible mechanism supported by telemetry/traces;
- unexpected observations;
- hypotheses met/not met;
- practical versus statistical importance.

## Limitations

Restate threats relevant to this campaign. Do not generalize results to real IRCTC.

## Artifact links

- run manifests:
- raw k6:
- metrics:
- traces:
- reconciliation:
- analysis:
- cost export:
