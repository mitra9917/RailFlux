# Second-contributor reproducibility walkthrough (M7 #69)

Another contributor reproduces the experiment path from a **clean clone** through **one valid principal pair** (baseline + optimized legs). This satisfies the [Definition of Done — Documentation](../definition-of-done.md) item and feeds the M7 gate ([#70](https://github.com/mitra9917/RailFlux/issues/70)).

Record outcomes in [reproducibility walkthrough notes](../milestones/reproducibility-walkthrough-notes.md).

## Scope

| In scope | Out of scope |
| --- | --- |
| Local Docker MySQL, k6, baseline + optimized Compose profiles | Paid AWS confirmatory campaign |
| One smoke pair (`C1-L80-legit`, 60s k6 per scenario) | Full 20-pair principal campaign |
| Artifacts under `experiment/runs/` and `experiment/campaigns/` | Publishing confirmatory statistics |

Smoke duration is **not** confirmatory; it proves the runbook, manifests, controller, and validity gates are reproducible.

## Prerequisites

- Fresh clone (or `git clean -fdx` only if you accept losing local experiment outputs).
- Node.js **≥ 20**, Docker, [k6](https://k6.io/docs/get-started/installation/), `curl`.
- No API listening on `:3000` unless you intend to use it for the walkthrough.

## 1. Clean install

```bash
git clone https://github.com/mitra9917/RailFlux.git
cd RailFlux
git checkout main   # or the release tag / PR branch under test
npm ci
```

Copy `services/baseline/.env.example` → `services/baseline/.env` if missing (see [dev stack](../../scripts/dev-stack.sh)).

## 2. Database and fixture

```bash
export MYSQL_PORT=3307
npm run db:bootstrap
npm run verify:fixture
```

Confirm `experiment/hypotheses.yaml` has **`status: frozen`** (PT-002 calibration).

## 3. Generator preflight (host load)

```bash
export SYNTHETIC_JWT_SECRET='dev-only-change-me'
npm run load:preflight
```

If preflight fails on a busy laptop, retry after closing heavy apps or set `GENERATOR_PREFLIGHT_MAX_HOST_LOAD_PCT=85` for this walkthrough only (document in notes).

## 4. Baseline leg

Terminal A — baseline API:

```bash
export SYNTHETIC_JWT_SECRET='dev-only-change-me'
export MYSQL_PORT=3307
npm run compose:baseline
```

Wait for `GET http://127.0.0.1:3000/health/live` → 200.

Terminal B — run **only the baseline manifest** for the walkthrough pair, or start the full smoke campaign and stop after the first leg (see step 5). Recommended: full smoke campaign with manual profile switch between legs.

## 5. One valid pair (smoke campaign)

Use a dedicated campaign id so notes stay unambiguous:

```bash
export SYNTHETIC_JWT_SECRET='dev-only-change-me'
export MYSQL_PORT=3307
export GENERATOR_PREFLIGHT_MAX_HOST_LOAD_PCT=85
npm run experiment:principal-campaign -- \
  --smoke \
  --campaign-id repro-walkthrough-001
```

The runner prints `principal_campaign_leg_start` events with `architecture` **baseline** then **optimized**.

1. **Before the baseline leg:** baseline Compose must be up (step 4).
2. **After baseline completes and before the optimized leg:** stop baseline, start optimized:

   ```bash
   # Terminal A: Ctrl+C baseline, then:
   npm run compose:optimized
   ```

3. Let the campaign finish both legs.

Expected artifacts:

| Path | Expectation |
| --- | --- |
| `experiment/campaigns/repro-walkthrough-001.json` | `runs_valid: 2`, `runs_invalid: 0` |
| `experiment/runs/<run_id>.json` | each leg `valid: true` |
| `experiment/runs/<run_id>.result.json` | validates against `result.schema.json` |

Verify:

```bash
npm run experiment:verify-repro-pair -- experiment/campaigns/repro-walkthrough-001.json
```

## 6. Downstream tooling (sanity)

Optional but recommended — proves analysis/report paths work on your artifacts:

```bash
npm run experiment:results-dashboard -- --campaign repro-walkthrough-001
npm run experiment:generate-report -- --campaign repro-walkthrough-001
```

Open `experiment/dashboard/output/` and `experiment/reports/repro-walkthrough-001-report.md` locally (gitignored outputs).

## 7. File notes

Complete [reproducibility walkthrough notes](../milestones/reproducibility-walkthrough-notes.md): contributor, date, starting SHA, run ids, deviations, sign-off. Commit notes in the PR that closes #69 or attach them to the M7 gate PR ([#70](https://github.com/mitra9917/RailFlux/issues/70)).

## Automated checks (maintainers / CI)

Dry-run plan (no Docker):

```bash
npm run gate:m7-repro
```

After a live walkthrough, re-run:

```bash
npm run experiment:verify-repro-pair -- experiment/campaigns/repro-walkthrough-001.json
```

## Related runbooks

- [Experiment runbook](./experiment.md)
- [Principal paired campaign](./principal-campaign.md)
- [Generator preflight](./generator-preflight.md)
- [M6 acceptance gate](./m6-gate.md) — engine prerequisites
