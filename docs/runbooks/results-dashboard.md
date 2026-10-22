# Results dashboard and cost parity (M7 #67)

Static **HTML + JSON** dashboard from principal campaign results — latency, success, cache condition, queue p99 (when present), SLO-compliant RPS per USD, and **cost parity** tables. Sections without data are listed under **Not claimed** (no unmeasured claims).

## Prerequisites

- Campaign inventory JSON (`experiment/campaigns/<id>.json`)
- Optional: `experiment/runs/<run_id>.result.json` for valid pairs
- Optional: `experiment/analysis/output/<id>-analysis.json` from `npm run experiment:analyze-pairs`

## Generate

```bash
npm run experiment:results-dashboard -- \
  --campaign experiment/campaigns/principal-local-001.json \
  --analysis experiment/analysis/output/principal-local-001-analysis.json
```

Outputs (gitignored):

- `experiment/dashboard/output/<campaign_id>-dashboard.json`
- `experiment/dashboard/output/<campaign_id>-dashboard.html`

Open the HTML file in a browser for charts and tables.

## Final report link

In `experiment/report-template.md` § **Artifact links**, add:

```markdown
- results dashboard: experiment/dashboard/output/<campaign_id>-dashboard.html
- dashboard data: experiment/dashboard/output/<campaign_id>-dashboard.json
```

## Cost parity

Populated from run manifest `resources.*` and `cost.estimated_hourly_usd`. Protocol **±5%** hourly check is computed when both architectures have numeric estimates. Fill manifest costs before AWS sessions ([deployment runbook](./deployment.md)).

## Measured vs not measured

| Panel | Source |
| --- | --- |
| Latency p99 | `result.schema.json` `latencyMs` |
| Terminal success rate | `demand.completed / offered` |
| Cache | `cache_condition` only (not Redis hit ratio) |
| Queue | `latencyMs.queue_p99` when exported |
| RPS / USD | SLO-compliant offered RPS ÷ hourly cost when cost fields exist |
| Cache hit / queue depth / RDS | Requires CloudWatch export — listed as unmeasured until linked |
