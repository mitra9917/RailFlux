# Reproducibility walkthrough notes (M7 #69)

Complete this after following [Second-contributor reproducibility walkthrough](../runbooks/reproducibility-walkthrough.md). Commit updates on the branch or PR that records the walkthrough (issue **#69** / M7 gate **#70**).

## Record

| Field | Value |
| --- | --- |
| Contributor | _fill in_ |
| Date (UTC) | _fill in_ |
| Git SHA at start (`git rev-parse HEAD`) | _fill in_ |
| Campaign ID | `repro-walkthrough-001` |
| Environment | local Docker / other: _describe_ |

## Checklist

- [ ] Fresh clone or documented clean starting point
- [ ] `npm ci` succeeded
- [ ] `npm run db:bootstrap` and `npm run verify:fixture` succeeded
- [ ] `experiment/hypotheses.yaml` status is `frozen`
- [ ] `npm run load:preflight` passed (note any `GENERATOR_PREFLIGHT_MAX_HOST_LOAD_PCT` override)
- [ ] Baseline leg: `compose:baseline`, health check OK
- [ ] Optimized leg: switched to `compose:optimized` before second leg
- [ ] `npm run experiment:principal-campaign -- --smoke --campaign-id repro-walkthrough-001` exit 0
- [ ] `npm run experiment:verify-repro-pair -- experiment/campaigns/repro-walkthrough-001.json` exit 0

## Valid pair evidence

| Leg | `run_id` | `valid` | Run index path |
| --- | --- | --- | --- |
| baseline | | | `experiment/runs/…` |
| optimized | | | `experiment/runs/…` |

Campaign export: `experiment/campaigns/repro-walkthrough-001.json`

Paste verifier output (optional):

```json

```

## Deviations, blockers, and environment notes

_Document anything that differed from the runbook (OS, Docker version, preflight retries, profile switch timing, etc.)._

## Sign-off

- [ ] I obtained **at least one fully valid pair** (both legs valid) using only the documented runbook.
- [ ] Invalid runs, if any, are archived with reasons in run indexes (do not delete).

**Signed:** _name / handle_ — _date_
