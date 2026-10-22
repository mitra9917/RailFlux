import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');

test('M6 #56 PT-001 k6 script uses constant-arrival-rate 1–5 RPS', () => {
  const script = readFileSync(join(root, 'load-tests/k6/pt-001-smoke.js'), 'utf8');
  assert.match(script, /constant-arrival-rate/);
  assert.match(script, /PT001_RATE/);
  assert.match(script, /X-Run-Id/);
  assert.match(script, /\/v1\/search/);
  assert.match(script, /SAB/);
});

test('M6 #56 run-pt001-smoke exports summary raw and artifact index', () => {
  const runner = readFileSync(join(root, 'load-tests/scripts/run-pt001-smoke.sh'), 'utf8');
  assert.match(runner, /summary-export/);
  assert.match(runner, /write-pt001-artifact/);
  assert.match(runner, /check-baseline-health/);
  assert.match(runner, /1–5 RPS|1-5 RPS/);
});

test('M6 #56 PT-001 documented in load-tests README', () => {
  const readme = readFileSync(join(root, 'load-tests/README.md'), 'utf8');
  assert.match(readme, /load:pt001/);
  assert.match(readme, /PT-001/);
});
