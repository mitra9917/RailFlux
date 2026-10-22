import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { buildRunRecord, writeRunRecord } from '../experiment/controller/export-run-record.mjs';
import {
  parseControllerManifestText,
  resolveRunId,
} from '../experiment/controller/parse-run-manifest.mjs';

const root = join(import.meta.dirname, '..');

test('M6 #58 parseControllerManifestText reads pair and cache fields', () => {
  const text = readFileSync(join(root, 'experiment/load-pt-local.example.yaml'), 'utf8');
  const parsed = parseControllerManifestText(text);
  assert.equal(parsed.pairId, 'load-dev');
  assert.equal(parsed.pairOrder, 'AB');
  assert.equal(parsed.cacheCondition, 'none');
  assert.equal(parsed.cohortMix.legitimate, 1);
  assert.equal(parsed.cohortMix.bot_like, 0);
});

test('M6 #58 resolveRunId generates when manifest run_id is TO_SET', () => {
  const parsed = parseControllerManifestText('run_id: TO_SET\narchitecture: baseline\n');
  const runId = resolveRunId(parsed, { now: () => Date.parse('2026-10-22T10:00:00.000Z') });
  assert.match(runId, /^run-20261022T100000Z$/);
});

test('M6 #58 buildRunRecord links k6 artifacts and validity', () => {
  const record = buildRunRecord({
    runId: 'run-test',
    manifestPath: join(root, 'experiment/load-pt-local.example.yaml'),
    manifest: { pairId: 'p1', architecture: 'baseline' },
    fixtureVerification: { event: 'fixture_verified' },
    protocolSteps: { '10_execute_workload': { status: 'passed', detail: null } },
    k6Artifacts: [{ path: '/tmp/a.json', index: { test_id: 'PT-005' } }],
    correctness: { event: 'correctness_passed' },
    valid: true,
    invalidReason: null,
  });
  assert.equal(record.run_id, 'run-test');
  assert.equal(record.valid, true);
  assert.equal(record.k6_artifacts.length, 1);
  assert.equal(record.record_type, 'experiment_run_index');
});

test('M6 #58 controller run.sh documents protocol orchestration', () => {
  const runner = readFileSync(join(root, 'experiment/controller/run.sh'), 'utf8');
  assert.match(runner, /verify-fixture\.mjs/);
  assert.match(runner, /run-load-from-manifest\.sh/);
  assert.match(runner, /run-correctness\.sh/);
  assert.match(runner, /finalize-run\.mjs/);
  const readme = readFileSync(join(root, 'docs/runbooks/experiment.md'), 'utf8');
  assert.match(readme, /experiment:run/);
});

test('M6 #58 writeRunRecord writes under experiment/runs', () => {
  const runId = `test-controller-${Date.now()}`;
  const out = writeRunRecord(runId, buildRunRecord({
    runId,
    manifest: {},
    valid: false,
    invalidReason: 'unit_test',
  }));
  assert.match(out, /experiment\/runs\//);
  assert.match(readFileSync(out, 'utf8'), /experiment_run_index/);
});
