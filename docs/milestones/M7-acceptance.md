# M7 acceptance gate

**Milestone:** M7 — Campaign, analysis & delivery  
**Gate issue:** #70

## Prerequisites (issues #63–#69)

| Issue | Deliverable |
| --- | --- |
| #63 | PT-002 stepped calibration, pilot artifact, `npm run load:pt002`, freeze `hypotheses.yaml` |
| #64 | `npm run experiment:principal-campaign`, four cells, sequential pairs, invalid run archive |
| #65 | `npm run experiment:failure-campaign`, FT-001/002/003/005/007 at ~80% load, recovery in result schema |
| #66 | `npm run experiment:analyze-pairs`, log-ratio paired bootstrap 95% CI, Holm secondaries |
| #67 | `npm run experiment:results-dashboard`, cost parity tables, HTML charts linked from report |
| #68 | `npm run experiment:generate-report`, DoD Evidence checklist from measured artifacts |
| #69 | [Reproducibility walkthrough](../runbooks/reproducibility-walkthrough.md), [notes template](./reproducibility-walkthrough-notes.md), `npm run gate:m7-repro` |

## Gate criteria (#70)

| Criterion | Verification |
| --- | --- |
| Contract + M7 unit tests | `npm run ci`, `npm run test:m7-gate`, `npm run gate:m7-repro` |
| Principal campaign complete **or** budget amendment | [M7-budget-amendment.md](./M7-budget-amendment.md) + `npm run experiment:verify-m7-acceptance` |
| Report + DoD signed off | [M7-gate-signoff.md](./M7-gate-signoff.md) |

```bash
npm run gate:m7
```

Optional live acceptance after campaign + sign-off:

```bash
export M7_GATE_CAMPAIGN=experiment/campaigns/<campaign_id>.json
npm run gate:m7
```

See [m7-gate runbook](../runbooks/m7-gate.md).
