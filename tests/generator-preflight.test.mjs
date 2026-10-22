import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  aggregatePreflightChecks,
  evaluateHostPreflight,
  evaluateK6GeneratorPreflight,
} from '../load-tests/scripts/generator-preflight.mjs';

const root = join(import.meta.dirname, '..');
const k6Fixture = JSON.parse(
  readFileSync(join(root, 'tests/fixtures/k6-summary-minimal.json'), 'utf8'),
);

test('M6 #61 host load gate fails at or above 70%', () => {
  const pass = evaluateHostPreflight({ loadPct: 55, cpus: 8, load1: 4.4 });
  const fail = evaluateHostPreflight({ loadPct: 72, cpus: 8, load1: 5.76 });
  assert.equal(pass.ok, true);
  assert.equal(fail.ok, false);
});

test('M6 #61 k6 gate flags dropped iterations above protocol limit', () => {
  const summary = {
    metrics: {
      iterations: { count: 1000 },
      dropped_iterations: { count: 5 },
      http_req_blocked: { 'p(95)': 10 },
      iteration_duration: { med: 20, max: 50 },
    },
  };
  const fail = evaluateK6GeneratorPreflight(summary);
  assert.equal(fail.ok, false);
  assert.ok(fail.reasons?.includes('dropped_iterations_above_limit'));
});

test('M6 #61 k6 fixture summary passes generator gate', () => {
  const ok = evaluateK6GeneratorPreflight(k6Fixture);
  assert.equal(ok.ok, true);
});

test('M6 #61 load runners invoke generator preflight', () => {
  const pt001 = readFileSync(join(root, 'load-tests/scripts/run-pt001-smoke.sh'), 'utf8');
  const manifest = readFileSync(join(root, 'load-tests/scripts/run-load-from-manifest.sh'), 'utf8');
  assert.match(pt001, /run-generator-preflight/);
  assert.match(manifest, /run-generator-preflight/);
  assert.match(manifest, /generator-preflight\.mjs.*k6-summary/);
});

test('M6 #61 aggregatePreflightChecks sets generator_cpu_max_pct', () => {
  const agg = aggregatePreflightChecks([
    { gate: 'host_cpu_load', ok: true, load_pct: 12.5 },
    { gate: 'k6_generator', ok: true },
  ]);
  assert.equal(agg.ok, true);
  assert.equal(agg.generator_cpu_max_pct, 12.5);
});
