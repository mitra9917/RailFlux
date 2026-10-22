/**
 * Static HTML results dashboard (M7 #67) — no external chart dependencies.
 */
import { chartSeriesFromDashboard } from './build-dashboard-data.mjs';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function barChart(title, labels, seriesA, seriesB, unit) {
  const values = [...seriesA, ...seriesB].filter((v) => typeof v === 'number' && Number.isFinite(v));
  const max = values.length ? Math.max(...values, 1) : 1;
  const rows = labels
    .map((label, i) => {
      const b = seriesA[i];
      const o = seriesB[i];
      const bWidth = typeof b === 'number' ? (b / max) * 100 : 0;
      const oWidth = typeof o === 'number' ? (o / max) * 100 : 0;
      return `<tr>
        <td>${escapeHtml(label)}</td>
        <td>${typeof b === 'number' ? b.toFixed(2) : '—'} ${unit}</td>
        <td><div class="bar baseline" style="width:${bWidth.toFixed(1)}%"></div></td>
        <td>${typeof o === 'number' ? o.toFixed(2) : '—'} ${unit}</td>
        <td><div class="bar optimized" style="width:${oWidth.toFixed(1)}%"></div></td>
      </tr>`;
    })
    .join('\n');

  return `<section><h2>${escapeHtml(title)}</h2>
<table class="chart"><thead><tr><th>Pair</th><th>Baseline</th><th></th><th>Optimized</th><th></th></tr></thead>
<tbody>${rows}</tbody></table></section>`;
}

function costParityTable(cost) {
  const rows = ['baseline', 'optimized']
    .map((arch) => {
      const row = cost[arch];
      if (!row) return `<tr><td>${arch}</td><td colspan="4">No manifest row</td></tr>`;
      return `<tr>
        <td>${arch}</td>
        <td>${escapeHtml(String(row.request_serving_vcpu_max_total ?? '—'))}</td>
        <td>${escapeHtml(String(row.request_serving_memory_gib_max_total ?? '—'))}</td>
        <td>${escapeHtml(String(row.database_class ?? '—'))}</td>
        <td>${row.estimated_hourly_usd != null ? row.estimated_hourly_usd.toFixed(2) : '—'}</td>
      </tr>`;
    })
    .join('\n');
  const parity =
    cost.cost_parity_within_five_pct == null
      ? 'Not computed (missing hourly estimates)'
      : cost.cost_parity_within_five_pct
        ? 'Within ±5% hourly cost parity'
        : `Outside ±5% (Δ ${cost.hourly_delta_pct}%)`;

  return `<section><h2>Resource &amp; cost parity</h2>
<p class="parity">${escapeHtml(parity)}</p>
${cost.notes ? `<p class="note">${escapeHtml(cost.notes)}</p>` : ''}
<table><thead><tr><th>Architecture</th><th>Req-serving vCPU</th><th>Memory (GiB)</th><th>DB class</th><th>Est. $/hr</th></tr></thead>
<tbody>${rows}</tbody></table></section>`;
}

/**
 * @param {ReturnType<import('./build-dashboard-data.mjs').buildDashboardData>} data
 */
export function renderDashboardHtml(data) {
  const charts = chartSeriesFromDashboard(data);
  const unmeasured = (data.unmeasured_claims ?? [])
    .map((u) => `<li>${escapeHtml(u)}</li>`)
    .join('\n');

  const analysisBlock = data.analysis
    ? `<section><h2>Paired analysis summary</h2><ul>${(data.analysis.hypothesis_metrics ?? [])
        .map(
          (m) =>
            `<li><strong>${escapeHtml(m.hypothesis_id)}</strong> ${escapeHtml(m.metric ?? '')}: ` +
            `${m.geometric_mean_ratio != null ? `ratio ${m.geometric_mean_ratio.toFixed(3)}` : m.status}` +
            `${m.ci_95_ratio ? ` CI [${m.ci_95_ratio.map((x) => x?.toFixed(3)).join(', ')}]` : ''}` +
            `</li>`,
        )
        .join('\n')}</ul></section>`
    : '<section><h2>Paired analysis summary</h2><p class="note">No analysis JSON linked — run npm run experiment:analyze-pairs.</p></section>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>RailFlux results — ${escapeHtml(data.campaign_id)}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; max-width: 1100px; color: #111; }
    h1 { font-size: 1.4rem; }
    h2 { font-size: 1.1rem; margin-top: 2rem; }
    table { border-collapse: collapse; width: 100%; margin: 0.5rem 0 1rem; font-size: 0.9rem; }
    th, td { border: 1px solid #ccc; padding: 0.35rem 0.5rem; text-align: left; vertical-align: middle; }
    .bar { height: 0.65rem; border-radius: 2px; min-width: 2px; }
    .bar.baseline { background: #2563eb; }
    .bar.optimized { background: #16a34a; }
    .note, .parity { color: #444; font-size: 0.9rem; }
    .meta { color: #666; font-size: 0.85rem; }
    ul.unmeasured { color: #663; }
  </style>
</head>
<body>
  <h1>Experiment results dashboard</h1>
  <p class="meta">Campaign <strong>${escapeHtml(data.campaign_id)}</strong> · valid pairs ${data.pair_summary.valid}/${data.pair_summary.total} · generated ${escapeHtml(data.generated_at)}</p>
  ${costParityTable(data.cost_parity)}
  ${barChart('Terminal latency p99', charts.labels, charts.latency_p99_ms.baseline, charts.latency_p99_ms.optimized, 'ms')}
  ${barChart('Terminal success rate', charts.labels, charts.terminal_success_rate.baseline, charts.terminal_success_rate.optimized, 'ratio')}
  ${barChart('Queue p99 (when measured)', charts.labels, charts.queue_p99_ms.baseline, charts.queue_p99_ms.optimized, 'ms')}
  ${barChart('SLO-compliant offered RPS per USD', charts.labels, charts.slo_compliant_rps_per_usd.baseline, charts.slo_compliant_rps_per_usd.optimized, 'RPS/$')}
  <section><h2>Cache condition (not hit ratio)</h2>
  <table><thead><tr><th>Pair</th><th>Baseline</th><th>Optimized</th></tr></thead><tbody>
  ${charts.cache_condition
    .map(
      (c) =>
        `<tr><td>${escapeHtml(c.pair_id)}</td><td>${escapeHtml(c.baseline ?? '—')}</td><td>${escapeHtml(c.optimized ?? '—')}</td></tr>`,
    )
    .join('\n')}
  </tbody></table></section>
  ${analysisBlock}
  <section><h2>Not claimed (unmeasured in this export)</h2>
  <ul class="unmeasured">${unmeasured}</ul></section>
  <p class="meta">Link this file from <code>experiment/report-template.md</code> § Artifact links. Only sections with data support claims.</p>
</body>
</html>`;
}
