# M7 acceptance gate (M7 #70)

Validates **campaign tooling, analysis, report, and reproducibility** in CI, with an optional **live acceptance** path when principal campaign artifacts and sign-off exist.

## Local gate (CI parity)

```bash
npm run gate:m7
```

### Always runs

1. `npm run ci`
2. `npm run test:m7-gate` — calibration, principal/failure campaigns, analysis, dashboard, report, repro walkthrough
3. `npm run gate:m7-repro` — walkthrough docs + dry-run smoke plan (#69)

## Live acceptance (optional)

When a principal campaign export and gate sign-off are ready:

```bash
export SYNTHETIC_JWT_SECRET='dev-only-change-me'
export MYSQL_PORT=3307

# After principal campaign (full or budget-reduced with amendment):
npm run experiment:verify-m7-acceptance -- \
  --campaign experiment/campaigns/<campaign_id>.json
```

Sign-off checklist: [M7-gate-signoff.md](../milestones/M7-gate-signoff.md) (all `[x]` items).

Budget-reduced campaigns (&lt; 20 planned pairs): document scope in [M7-budget-amendment.md](../milestones/M7-budget-amendment.md) and include the **campaign ID** in that file.

### Suggested evidence pipeline

```bash
npm run experiment:analyze-pairs -- --campaign experiment/campaigns/<campaign_id>.json
npm run experiment:results-dashboard -- --campaign <campaign_id>
npm run experiment:generate-report -- --campaign experiment/campaigns/<campaign_id>.json
```

## Gate criteria (#70)

| Criterion | Verification |
| --- | --- |
| M7 deliverables (#63–#69) | `test:m7-gate`, [M7 acceptance](../milestones/M7-acceptance.md) |
| Principal campaign complete **or** budget amendment | `experiment:verify-m7-acceptance` (live) |
| Report + DoD checklist signed off | [M7-gate-signoff.md](../milestones/M7-gate-signoff.md) |

## Related

- [Principal paired campaign](./principal-campaign.md)
- [Experiment report generator](./experiment-report.md)
- [Reproducibility walkthrough](./reproducibility-walkthrough.md)
- [M6 gate](./m6-gate.md) — experiment engine prerequisite
