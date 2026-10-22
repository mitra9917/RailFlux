import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { buildExperimentResult } from '../experiment/controller/export-result.mjs';
import { aggregateK6Summaries } from '../experiment/controller/k6-summary-metrics.mjs';
import { validateExperimentResult } from '../experiment/controller/validate-result-schema.mjs';

const root = join(import.meta.dirname, '..');
const k6Fixture = JSON.parse(
  readFileSync(join(root, 'tests/fixtures/k6-summary-minimal.json'), 'utf8'),
);

test('M6 #60 aggregateK6Summaries maps demand and latency', () => {
  const agg = aggregateK6Summaries([k6Fixture]);
  assert.equal(agg.demand.offered, 100);
  assert.equal(agg.demand.started, 100);
  assert.equal(agg.demand.completed, 100);
  assert.equal(agg.demand.dropped, 0);
  assert.equal(agg.latencyMs.terminal_p50, 12.5);
});

test('M6 #60 buildExperimentResult validates against result.schema.json when valid', () => {
  const input = {
    runId: 'run-test-valid',
    valid: true,
    invalidReason: null,
    manifest: {
      pairId: 'pair-test',
      pairOrder: 'AB',
      architecture: 'baseline',
      loadLevel: 'L80',
      cacheCondition: 'none',
      requestSeed: 772910,
      cohortMix: { legitimate: 0.8, bot_like: 0.2 },
    },
    fixtureVerification: { fixture_sha256: 'abc123' },
    correctness: { event: 'correctness_passed' },
    k6Artifacts: [
      {
        index: {
          artifacts: {
            k6_summary: join(root, 'tests/fixtures/k6-summary-minimal.json'),
            k6_raw: join(root, 'tests/fixtures/k6-summary-minimal.json'),
          },
        },
      },
    ],
  };
  const result = buildExperimentResult(input, {
    bookingStats: {
      confirmed_unique: 5,
      sold_out: 2,
      technical_failures: 0,
      timeouts_unknown: 0,
      oversells: 0,
      duplicate_charges: 0,
    },
  });
  const validation = validateExperimentResult(result);
  assert.equal(result.valid, true);
  assert.equal(result.correctness_passed, true);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors));
});

test('M6 #60 invalid run may set valid false while remaining schema-valid', () => {
  const result = buildExperimentResult({
    runId: 'run-test-invalid',
    valid: false,
    invalidReason: 'correctness_failed',
    manifest: { pairId: 'pair-x', architecture: 'baseline', requestSeed: 1 },
    fixtureVerification: { fixture_sha256: 'abc' },
    correctness: { event: 'correctness_failed' },
    k6Artifacts: [],
  });
  assert.equal(result.valid, false);
  const validation = validateExperimentResult(result);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors));
});

test('M6 #60 npm script documents export-result', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.match(pkg.scripts['experiment:export-result'], /export-result/);
});
