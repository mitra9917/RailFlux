# M5 acceptance gate (M5 #55)

Two layers: **local** (no AWS charges) and **AWS** (paid smoke acceptance).

## Local gate (CI parity)

```bash
npm run gate:m5
```

Runs `npm run ci`, `npm run cfn:validate`, and M5 infrastructure unit tests (`test:m5-gate`).

## AWS gate (acceptance)

**Goal:** Deploy **baseline** session → smokes → teardown → deploy **optimized** → smokes → teardown → **no paid orphans**.

Default is **dry-run** (prints commands only).

```bash
# Plan
npm run aws:gate:m5 -- \
  --baseline-manifest experiment/m5-gate-baseline.example.yaml \
  --optimized-manifest experiment/m5-gate-optimized.example.yaml

# Execute (paid — fill manifests, set env, review cost estimate first)
export SYNTHETIC_JWT_SECRET=...
export ACM_CERTIFICATE_ARN=...
export ORIGIN_HEADER_VALUE=...
export CONTAINER_IMAGE=...          # baseline phase
export CONTAINER_IMAGE_EDGE=...     # optimized phase
export CONTAINER_IMAGE_READ=...
export CONTAINER_IMAGE_BOOKING=...
export CONTAINER_IMAGE_WORKER=...

npm run aws:gate:m5 -- \
  --baseline-manifest experiment/m5-gate-baseline.example.yaml \
  --optimized-manifest experiment/m5-gate-optimized.example.yaml \
  --execute
```

Use **distinct** `deployment.session_name` values in each manifest (examples: `m5-gate-baseline`, `m5-gate-optimized`).

### Per-phase checks (execute)

| Step | Baseline | Optimized |
| --- | --- | --- |
| Preflight + deploy session | yes | yes |
| RDS migrate smoke | yes | yes |
| ECS/ALB smoke | yes | yes |
| SQS/worker smoke | — | yes |
| Observability smoke | yes | yes |
| Security ST-004/ST-005 | yes | yes |
| Teardown session + orphan audit | yes | yes |
| Account budgets smoke | once at start | |
| Final orphan audit (both regions) | after both phases | |

Evidence from security smoke: [security-smoke.md](security-smoke.md).

## Definition of done

- [ ] `npm run gate:m5` passes on a clean checkout.
- [ ] AWS gate executed once with `--execute` within cost estimate, or waived with written reason in run notes.
- [ ] `npm run aws:audit:orphans` exits 0 after gate teardown.
