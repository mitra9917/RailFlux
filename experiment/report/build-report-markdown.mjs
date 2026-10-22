/**
 * Render experiment report markdown from measured artifacts (M7 #68).
 */

function line(label, value) {
  const v = value == null || value === '' ? '_Not measured in this export_' : String(value);
  return `- ${label}: ${v}`;
}

function bulletList(items) {
  return items.map((i) => `- ${i}`).join('\n');
}

/**
 * @param {object} input
 */
export function buildReportMarkdown(input) {
  const {
    campaignId,
    campaign,
    dashboard,
    analysis,
    hypothesesMeta,
    dodEvidence,
    provenance,
    workloadSummary,
    invalidArchive,
  } = input;

  const analysisMetrics = (analysis?.metrics ?? []).filter((m) => m.status !== 'skipped');
  const resultsTable = analysisMetrics.length
    ? analysisMetrics
        .map((m) => {
          const ci =
            m.ci_95_ratio?.[0] != null
              ? `[${m.ci_95_ratio.map((x) => x?.toFixed(3)).join(', ')}]`
              : '—';
          return `| ${m.hypothesis_id} | ${m.metric ?? '—'} | ${m.n_pairs ?? 0} | ${m.geometric_mean_ratio?.toFixed(3) ?? '—'} | ${ci} |`;
        })
        .join('\n')
    : '_No paired analysis with n_pairs > 0._';

  const holmBlock = (analysis?.holm_secondary ?? []).length
    ? analysis.holm_secondary
        .map(
          (h) =>
            `- ${h.id}: p=${h.p_value?.toFixed(4) ?? '—'}, Holm threshold ${h.holm_threshold?.toFixed(4) ?? '—'}, reject=${h.holm_reject}`,
        )
        .join('\n')
    : '_No secondary Holm tests computed._';

  const measuredFindings = analysisMetrics
    .filter((m) => (m.n_pairs ?? 0) > 0)
    .map((m) => {
      const verdict =
        m.meets_minimum != null
          ? m.meets_minimum
            ? 'meets minimum effect (CI lower bound)'
            : 'does not meet minimum effect'
          : m.meets_maximum != null
            ? m.meets_maximum
              ? 'meets maximum effect bound (CI upper bound)'
              : 'does not meet maximum effect bound'
            : 'effect size reported only';
      return `- **${m.hypothesis_id}** (${m.metric}): geometric ratio ${m.geometric_mean_ratio?.toFixed(3) ?? '—'} — ${verdict}.`;
    })
    .join('\n');

  const dodSection = dodEvidence
    .map((d) => {
      const mark = d.satisfied ? 'x' : ' ';
      const extra = d.detail ? ` (${d.detail})` : d.note ? ` — ${d.note}` : '';
      return `- [${mark}] ${d.text}${extra}`;
    })
    .join('\n');

  const unmeasured = dashboard?.unmeasured_claims?.length
    ? bulletList(dashboard.unmeasured_claims)
    : '_See dashboard export for unmeasured telemetry list._';

  const invalidLines = (invalidArchive ?? []).slice(0, 15).map(
    (e) => `- ${e.run_id ?? e.pair_id}: ${e.reason ?? e.invalid_reason ?? 'unknown'}`,
  );
  const invalidSection = invalidLines.length
    ? `${invalidLines.join('\n')}${invalidArchive.length > 15 ? `\n- … and ${invalidArchive.length - 15} more` : ''}`
    : '_No invalid-run archive entries in campaign export._';

  const cost = dashboard?.cost_parity;
  const costBlock = cost
    ? `${line('Baseline est. $/hr', cost.baseline?.estimated_hourly_usd)}
${line('Optimized est. $/hr', cost.optimized?.estimated_hourly_usd)}
${line('Within ±5% parity', cost.cost_parity_within_five_pct)}
${cost.notes ? line('Note', cost.notes) : ''}`
    : '_Cost parity not computed — run results dashboard._';

  return `# Experiment Report: \`${campaignId}\`

> Auto-generated from measured artifacts only (\`experiment/report/generate-experiment-report.mjs\`). Do not treat empty sections as positive results.

## Provenance

${line('Application commit', provenance.application_git_sha)}
${line('Infrastructure commit', provenance.infrastructure_git_sha)}
${line('Fixture/checksum', provenance.fixture_sha256)}
${line('Request/randomization seeds', provenance.seeds)}
${line('AWS region', provenance.region)}
${line('Measurement dates', provenance.measurement_dates)}
${line('Valid/invalid runs', provenance.valid_invalid_summary)}

## Question and frozen hypotheses

- \`experiment/hypotheses.yaml\` revision: schema ${hypothesesMeta.schema_version ?? '—'}, status **${hypothesesMeta.status ?? '—'}**
- Calibration pilot: ${hypothesesMeta.pilot_run_id ?? '—'} (SLO capacity ${hypothesesMeta.slo_capacity_offered_rps ?? '—'} offered RPS)
- Protocol amendments: _None recorded in generator input._

## Resource and cost parity

${costBlock}

## Workload

${workloadSummary}

## Validity checks

${line('Fixture/reset', provenance.validity_fixture)}
${line('Generator capacity', provenance.validity_generator)}
${line('Telemetry completeness', dashboard ? 'Partial — see dashboard unmeasured list' : 'Not assessed')}
${line('Correctness reconciliation', analysis?.correctness?.H3_oversell_and_duplicate_zero?.ok != null ? (analysis.correctness.H3_oversell_and_duplicate_zero.ok ? 'H3 gate passed on valid pairs' : 'H3 gate failed') : 'Not assessed')}
${line('Deployment drift', 'Not auto-detected — verify manifest versions manually')}

## Results

Paired bootstrap summary (log-ratio optimized/baseline):

| Hypothesis | Metric | n pairs | Geometric ratio | 95% CI ratio |
| --- | --- | ---: | ---: | --- |
${resultsTable}

### Holm secondary tests

${holmBlock}

### Demand and latency (valid pairs)

${dashboard?.pairs?.length ? dashboard.pairs.map((p) => `- **${p.pair_id}**: baseline p99 ${p.baseline?.terminal_latency_p99_ms ?? '—'} ms, optimized ${p.optimized?.terminal_latency_p99_ms ?? '—'} ms; success rate ${p.baseline?.terminal_success_rate?.toFixed(3) ?? '—'} / ${p.optimized?.terminal_success_rate?.toFixed(3) ?? '—'}.`).join('\n') : '_No valid pairs in dashboard export._'}

## Correctness

${analysis?.correctness?.H3_oversell_and_duplicate_zero ? `- H3 oversell/duplicate on valid pairs: ${analysis.correctness.H3_oversell_and_duplicate_zero.ok ? 'PASS' : 'FAIL'} (${analysis.correctness.H3_oversell_and_duplicate_zero.valid_pairs_checked} pairs checked).` : '_Correctness block not in analysis export._'}

Inventory/outbox/DLQ reconciliation: link per-run \`experiment/runs/<run_id>.json\` correctness sections.

## Interpretation

### Measured findings

${measuredFindings || '_No hypothesis metrics with n_pairs > 0._'}

### Plausible mechanism supported by telemetry/traces

_Not assessed in this export (requires manual trace/log review)._

### Unexpected observations

_Record manually after reviewing invalid archive and raw k6._

### Hypotheses met/not met

See geometric ratios and CI columns above; generator does not infer causality.

### Practical versus statistical importance

_Record manually._

## Limitations

- Synthetic fixture and payment stub; not IRCTC production behavior.
- Do not generalize to private IRCTC architecture or capacity.
- Unmeasured telemetry (not claimed as results):

${unmeasured}

## Invalid-run archive (sample)

${invalidSection}

## Artifact links

- run manifests: \`experiment/campaigns/${campaignId}/manifests/\`
- campaign inventory: \`experiment/campaigns/${campaignId}.json\`
- analysis: \`experiment/analysis/output/${campaignId}-analysis.json\`
- results dashboard: \`experiment/dashboard/output/${campaignId}-dashboard.html\`
- dashboard data: \`experiment/dashboard/output/${campaignId}-dashboard.json\`
- raw k6 / metrics / traces / reconciliation: paths in each \`experiment/runs/<run_id>.json\`

## Definition of Done — Evidence

${dodSection}

---
Generated: ${input.generated_at}
Campaign event: ${campaign?.plan?.event ?? '—'}
`;
}
