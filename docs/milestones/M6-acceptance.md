# M6 acceptance gate

**Milestone:** M6 — Experiment engine & load tests  
**Gate issue:** #62

## Prerequisites (issues #56–#61)

| Issue | Deliverable |
| --- | --- |
| #56 | k6 PT-001 smoke, `npm run load:pt001` |
| #57 | PT-005/PT-006 from manifest, `npm run load:manifest` |
| #58 | Experiment controller, `npm run experiment:run` |
| #59 | Manifest generator + AB/BA, `npm run experiment:generate-manifest` |
| #60 | `result.schema.json` export, `npm run experiment:export-result` |
| #61 | Generator preflight, `npm run load:preflight` |

## Gate criteria (#62)

| Criterion | Verification |
| --- | --- |
| Contract + unit tests | `npm run ci`, `npm run test:m6-gate` |
| PT-001 + preflight | `load:pt001` in live gate path |
| Manifest export | `experiment:generate-manifest` writes pair YAML |
| Reproducible from reset | `db:reset` then `experiment:run` → index + validated `.result.json` |

```bash
npm run gate:m6
```

See [m6-gate runbook](../runbooks/m6-gate.md).
