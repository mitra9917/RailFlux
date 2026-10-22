# Experiment report generator (M7 #68)

Fills the structure of [report-template.md](../../experiment/report-template.md) from **measured artifacts only**. Empty or “not measured” sections are explicit so the report satisfies DoD Evidence without invented results.

## Pipeline

After campaign runs (and optional analysis + dashboard):

```bash
npm run experiment:analyze-pairs -- --campaign experiment/campaigns/principal-local-001.json
npm run experiment:results-dashboard -- --campaign experiment/campaigns/principal-local-001.json
npm run experiment:generate-report -- --campaign experiment/campaigns/principal-local-001.json
```

Output: `experiment/reports/<campaign_id>-report.md`

## Options

- `--analysis` / `--dashboard` — override default paths under `experiment/analysis/output/` and `experiment/dashboard/output/`
- `--runs experiment/runs` — load `*.result.json` for pair validity
- `--dry-run` — print JSON status only

## Definition of Done — Evidence

The report ends with an auto-checklist mapping [definition-of-done.md](../../docs/definition-of-done.md) Evidence items to satisfied/unsatisfied based on dashboard + analysis content. Manual sections (mechanism, unexpected observations) stay as placeholders for human edit **after** review.

## Template vs generated report

- `experiment/report-template.md` — canonical outline (unchanged).
- `experiment/reports/*-report.md` — generated, campaign-specific, safe to commit when filled with valid confirmatory data.
