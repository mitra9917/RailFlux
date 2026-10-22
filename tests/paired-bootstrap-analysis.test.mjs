import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { analyzePairedCampaign } from '../experiment/analysis/analyze-paired-campaign.mjs';
import { holmAdjust } from '../experiment/analysis/holm.mjs';
import {
  pairedBootstrapMeanLogRatio,
  pairedLogRatios,
} from '../experiment/analysis/paired-bootstrap.mjs';
import { loadHypothesesForAnalysis } from '../experiment/analysis/read-hypotheses-analysis.mjs';
import { evaluateResultSlo, sloCompliantOfferedBookingRate } from '../experiment/analysis/run-metrics.mjs';

const root = join(import.meta.dirname, '..');

function syntheticResult(architecture, offered, p99, valid = true) {
  return {
    schema_version: '1.0',
    run_id: `run-${architecture}`,
    pair_id: 'pair-1',
    architecture,
    fixture_sha256: 'x',
    request_seed: 1,
    valid,
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
  };
}

test('M7 #66 paired log ratios and bootstrap CI', () => {
  const pairs = [
    { baseline: 32, optimized: 40 },
    { baseline: 32, optimized: 41 },
    { baseline: 32, optimized: 39 },
    { baseline: 32, optimized: 42 },
    { baseline: 32, optimized: 40 },
  ];
  const logs = pairedLogRatios(pairs);
  assert.equal(logs.length, 5);
  const boot = pairedBootstrapMeanLogRatio(logs, { iterations: 2000, seed: 1 });
  assert.ok(boot.geometric_mean_ratio > 1.2);
  assert.ok(boot.ci_95_ratio[0] > 1);
  assert.ok(boot.ci_95_ratio[1] > boot.ci_95_ratio[0]);
});

test('M7 #66 Holm adjustment ordering', () => {
  const adjusted = holmAdjust([
    { id: 'H2', p_value: 0.04 },
    { id: 'H4', p_value: 0.01 },
    { id: 'H6', p_value: 0.2 },
  ]);
  assert.equal(adjusted[0].id, 'H4');
  assert.equal(adjusted[0].holm_reject, true);
});

test('M7 #66 hypotheses.yaml analysis block', () => {
  const doc = loadHypothesesForAnalysis(join(root, 'experiment/hypotheses.yaml'));
  assert.equal(doc.analysis.effect, 'log_ratio_optimized_over_baseline');
  assert.equal(doc.analysis.interval, 'paired_bootstrap_95_percent');
  assert.equal(doc.analysis.secondary_multiplicity, 'holm');
  assert.ok(doc.hypotheses.some((h) => h.id === 'H1' && h.primary));
});

test('M7 #66 slo compliant offered rate uses frozen cell RPS when SLO ok', () => {
  const result = syntheticResult('baseline', 5760, 100);
  const rate = sloCompliantOfferedBookingRate(result, { offered_rps: 32, duration_seconds: 180 });
  assert.equal(rate, 32);
  assert.equal(evaluateResultSlo(result).ok, true);
});

test('M7 #66 analyzePairedCampaign on synthetic valid pairs', () => {
  const pairRecords = [
    {
      pair_id: 'C1-L80-legit-r01',
      cell_id: 'C1-L80-legit',
      load_level: 'L80',
      status: 'valid',
      duration_seconds: 180,
      baseline_result: syntheticResult('baseline', 5760, 1500),
      optimized_result: syntheticResult('optimized', 5760, 900),
    },
    {
      pair_id: 'C1-L80-legit-r02',
      cell_id: 'C1-L80-legit',
      load_level: 'L80',
      status: 'valid',
      duration_seconds: 180,
      baseline_result: syntheticResult('baseline', 5760, 1600),
      optimized_result: syntheticResult('optimized', 5760, 950),
    },
  ];
  const doc = loadHypothesesForAnalysis(join(root, 'experiment/hypotheses.yaml'));
  const report = analyzePairedCampaign({
    campaign: { plan: { campaign_id: 'test-campaign' } },
    pairRecords,
    hypothesesDoc: doc,
    bootstrapIterations: 500,
    bootstrapSeed: 42,
  });
  assert.equal(report.event, 'paired_bootstrap_analysis');
  assert.equal(report.pair_summary.valid, 2);
  const h2 = report.metrics.find((m) => m.hypothesis_id === 'H2');
  assert.ok(h2);
  assert.ok(h2.geometric_mean_ratio < 1);
  assert.ok(Array.isArray(report.holm_secondary));
});

test('M7 #66 npm script entry', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.match(pkg.scripts['experiment:analyze-pairs'], /run-paired-analysis/);
});
