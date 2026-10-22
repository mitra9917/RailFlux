# M8 gate sign-off (issue #75)

Complete when closing the M8 milestone gate. Links: [M8 acceptance](./M8-acceptance.md), [m8-gate runbook](../runbooks/m8-gate.md).

| Field | Value |
| --- | --- |
| Signed by | _fill in_ |
| Date (UTC) | _fill in_ |
| Git SHA | _fill in_ |
| API profile tested | _baseline / optimized / both_ |

## Checklist

Mark with `[x]` when true (required for `npm run experiment:verify-m8-acceptance`).

- [ ] gate_automation_passed — `npm run gate:m8` (CI parity + frontend build + `test:m8-gate`)
- [ ] simulator_flow_local — Home → Search → Availability → Book → status on `:5173` + local API `:3000` with TC-001 demo user
- [ ] advisory_labels_reviewed — Search/Availability/Book show advisory banner and freshness labels (#74)
- [ ] synthetic_data_only — no real IRCTC credentials, payment cards, or PII in UI

## Notes

_Optional: PR URL, CI run, screenshot path, `M8_GATE_BASE_URL` used for live flow._
