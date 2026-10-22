import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  loadLevelToArrivalRate,
  parseLoadManifestText,
  resolveLoadPlan,
} from '../load-tests/scripts/load-manifest.mjs';

const root = join(import.meta.dirname, '..');

test('M6 #57 load_level maps to open-model RPS', () => {
  assert.equal(loadLevelToArrivalRate('L80'), 8);
  assert.equal(loadLevelToArrivalRate('L30'), 3);
  assert.equal(loadLevelToArrivalRate('bad', 5), 5);
});

test('M6 #57 resolveLoadPlan reads experiment fields', () => {
  const text = readFileSync(join(root, 'experiment/load-pt-local.example.yaml'), 'utf8');
  const parsed = parseLoadManifestText(text);
  assert.equal(parsed.inventoryProfile, 'contention');
  assert.equal(parsed.loadLevel, 'L30');
  assert.equal(parsed.durationSeconds, 30);
  const plan = resolveLoadPlan(join(root, 'experiment/load-pt-local.example.yaml'));
  assert.equal(plan.rate, 3);
  assert.equal(plan.duration, '30s');
  assert.equal(plan.runPt006, true);
});

test('M6 #57 k6 scripts use constant-arrival-rate', () => {
  const pt005 = readFileSync(join(root, 'load-tests/k6/pt-005-mixed-traffic.js'), 'utf8');
  const pt006 = readFileSync(join(root, 'load-tests/k6/pt-006-contention.js'), 'utf8');
  assert.match(pt005, /0\.7/);
  assert.match(pt005, /constant-arrival-rate/);
  assert.match(pt006, /inventoryId/);
  assert.match(pt006, /constant-arrival-rate/);
});

test('M6 #57 manifest runner documents scenarios', () => {
  const runner = readFileSync(
    join(root, 'load-tests/scripts/run-load-from-manifest.sh'),
    'utf8',
  );
  assert.match(runner, /PT-005/);
  assert.match(runner, /PT-006/);
  assert.match(runner, /load-manifest.mjs/);
});
