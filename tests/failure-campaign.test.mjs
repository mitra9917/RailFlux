import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  FAILURE_TESTS,
  selectFailureTests,
} from '../experiment/campaign/failure-tests.mjs';
import {
  buildFailureCampaignPlan,
  DEFAULT_FAILURE_DURATION_SECONDS,
} from '../experiment/campaign/run-failure-campaign.mjs';
import { arrivalRateForLoadLevel, parseHypothesesCalibration } from '../experiment/campaign/read-hypotheses.mjs';
import { parseControllerManifestText } from '../experiment/controller/parse-run-manifest.mjs';
import { renderRunManifestYaml } from '../experiment/controller/generate-run-manifest.mjs';

const root = join(import.meta.dirname, '..');

test('M7 #65 five selected failure tests', () => {
  assert.equal(FAILURE_TESTS.length, 5);
  assert.deepEqual(
    FAILURE_TESTS.map((t) => t.id),
    ['FT-001', 'FT-002', 'FT-003', 'FT-005', 'FT-007'],
  );
});

test('M7 #65 failure campaign default eight runs at L80 failure load', () => {
  const plan = buildFailureCampaignPlan({ campaignId: 'test-failure' });
  assert.equal(plan.run_count, 8);
  assert.equal(plan.runs[0].manifest.experiment.load_level, 'failure');
  assert.equal(plan.runs[0].manifest.failure_injection.enabled, true);
  assert.equal(plan.runs[0].manifest.failure_injection.failure_test_id, 'FT-001');
  assert.equal(plan.duration_seconds, DEFAULT_FAILURE_DURATION_SECONDS);
});

test('M7 #65 failure load level maps to frozen pct_80 RPS', () => {
  const hyp = readFileSync(join(root, 'experiment/hypotheses.yaml'), 'utf8');
  const cal = parseHypothesesCalibration(hyp);
  assert.equal(arrivalRateForLoadLevel('failure', cal), 32);
});

test('M7 #65 manifest round-trip failure_injection fields', () => {
  const plan = buildFailureCampaignPlan({ campaignId: 'rt', testIds: ['FT-005'], maxRuns: 1 });
  const yaml = renderRunManifestYaml(plan.runs[0].manifest);
  const parsed = parseControllerManifestText(yaml);
  assert.equal(parsed.failureInjection.enabled, true);
  assert.equal(parsed.failureInjection.type, 'db_latency_250ms');
  assert.equal(parsed.failureInjection.failure_test_id, 'FT-005');
  assert.equal(parsed.loadLevel, 'failure');
});

test('M7 #65 selectFailureTests and npm entry', () => {
  assert.equal(selectFailureTests(FAILURE_TESTS, ['FT-007']).length, 1);
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.match(pkg.scripts['experiment:failure-campaign'], /run-failure-campaign/);
  assert.match(pkg.scripts['experiment:failure-campaign:smoke'], /smoke/);
});
