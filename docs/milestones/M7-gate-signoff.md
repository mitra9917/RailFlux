# M7 gate sign-off (issue #70)

Complete when closing the M7 milestone gate. Links: [M7 acceptance](./M7-acceptance.md), [m7-gate runbook](../runbooks/m7-gate.md).

| Field | Value |
| --- | --- |
| Signed by | _fill in_ |
| Date (UTC) | _fill in_ |
| Git SHA | _fill in_ |
| Principal campaign ID | _fill in_ |
| Report path | `experiment/reports/<campaign_id>-report.md` |

## Checklist

Mark with `[x]` when true (required for `npm run experiment:verify-m7-acceptance`).

- [ ] campaign_scope_accepted — protocol-full campaign **or** [budget amendment](./M7-budget-amendment.md) on file
- [ ] report_generated — `npm run experiment:generate-report` for the campaign; no invented metrics
- [ ] dod_evidence_reviewed — DoD Evidence section matches measured artifacts; limitations explicit
- [ ] reproducibility_walkthrough_recorded — [walkthrough notes](./reproducibility-walkthrough-notes.md) completed (#69)

## Notes

_Optional: link PR, CI run, dashboard HTML path, analysis JSON._
