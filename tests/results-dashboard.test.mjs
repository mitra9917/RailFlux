import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { buildDashboardData, chartSeriesFromDashboard } from '../experiment/dashboard/build-dashboard-data.mjs';
import { buildCostParityTable, parseNumericCost } from '../experiment/dashboard/cost-parity.mjs';
import { renderDashboardHtml } from '../experiment/dashboard/render-dashboard-html.mjs';

const root = join(import.meta.dirname, '..');

function result(architecture, p99, offered = 1000) {
  return {
    run_id: `r-${architecture}`,
    architecture,
    valid: true,
    correctness_passed: true,
    demand: { offered, started: offered, completed: offered, dropped: 0 },
    booking: {
      confirmed_unique: 10,
      sold_out: 0,
      technical_failures: 0,
      oversells: 0,
      duplicate_charges: 0,
    },
    latencyMs: { terminal_p50: 10, terminal_p95: 20, terminal_p99: p99 },
    cache_condition: architecture === 'optimized' ? 'warm' : 'none',
    resources: { actual_run_usd: 2.5 },
  };
}

test('M7 #67 cost parity within five percent', () => {
  const campaign = {
    plan: {
      pairs: [
        {
          manifests: [
            {
              architecture: 'baseline',
              resources: { database_class: 'db.t4g.medium' },
              cost: { estimated_hourly_usd: '10.00' },
            },
            {
              architecture: 'optimized',
              resources: { database_class: 'db.t4g.medium', cache_class: 'cache.t4g.micro' },
              cost: { estimated_hourly_usd: '10.40' },
            },
          ],
        },
      ],
    },
  };
  const table = buildCostParityTable(campaign);
  assert.equal(parseNumericCost('10.00'), 10);
  assert.equal(table.cost_parity_within_five_pct, true);
  assert.ok(table.hourly_delta_pct != null && table.hourly_delta_pct <= 5);
});

test('M7 #67 dashboard data only uses valid pairs', () => {
  const data = buildDashboardData({
    campaign: { plan: { campaign_id: 'dash-test' } },
    pairRecords: [
      {
        pair_id: 'p1',
        cell_id: 'C1',
        load_level: 'L80',
        status: 'valid',
        duration_seconds: 180,
        baseline_result: result('baseline', 1500),
        optimized_result: result('optimized', 900),
      },
      {
        pair_id: 'p2',
        status: 'missing_results',
      },
    ],
  });
  assert.equal(data.pair_summary.valid, 1);
  assert.equal(data.pairs.length, 1);
  assert.ok(data.unmeasured_claims.length > 0);
  const charts = chartSeriesFromDashboard(data);
  assert.equal(charts.labels.length, 1);
});

test('M7 #67 HTML dashboard renders cost parity and unmeasured list', () => {
  const data = buildDashboardData({
    campaign: {
      plan: {
        campaign_id: 'html-test',
        pairs: [
          {
            manifests: [
              { architecture: 'baseline', cost: { estimated_hourly_usd: '1' }, resources: {} },
              { architecture: 'optimized', cost: { estimated_hourly_usd: '1' }, resources: {} },
            ],
          },
        ],
      },
    },
    pairRecords: [
      {
        pair_id: 'p1',
        cell_id: 'C1',
        load_level: 'L80',
        status: 'valid',
        duration_seconds: 180,
        baseline_result: result('baseline', 100),
        optimized_result: result('optimized', 80),
      },
    ],
  });
  const html = renderDashboardHtml(data);
  assert.match(html, /html-test/);
  assert.match(html, /Resource &amp; cost parity/);
  assert.match(html, /Not claimed/);
});

test('M7 #67 npm script entry', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.match(pkg.scripts['experiment:results-dashboard'], /run-results-dashboard/);
});
