import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { runPilotLogic } from '../experiment/calibration/run-pt002-pilot.mjs';
import { parseK6SummaryFile } from '../experiment/controller/k6-summary-metrics.mjs';

const root = join(import.meta.dirname, '..');
const minimalPath = join(root, 'tests/fixtures/k6-summary-minimal.json');

test('M7 #63 PT-002 k6 script uses constant-arrival-rate and 70/20/10 mix', () => {
  const script = readFileSync(join(root, 'load-tests/k6/pt-002-calibration-step.js'), 'utf8');
  assert.match(script, /constant-arrival-rate/);
  assert.match(script, /PT002_RATE/);
  assert.match(script, /roll < 0\.7/);
  assert.match(script, /bookingPostOptions/);
});

test('M7 #63 run-pt002-calibration documents freeze and dry-run', () => {
  const runner = readFileSync(join(root, 'load-tests/scripts/run-pt002-calibration.sh'), 'utf8');
  assert.match(runner, /resolve-k6-auth/);
  assert.match(runner, /run-pt002-pilot\.mjs/);
  assert.match(runner, /freeze-hypotheses/);
  assert.match(runner, /--dry-run/);
});

test('M7 #63 pilot dry-run emits planned rates', () => {
  const result = runPilotLogic({
    runId: 'dry',
    baseUrl: 'http://127.0.0.1:3000',
    startRate: 5,
    stepRate: 5,
    maxRate: 15,
    stepDuration: '60s',
    dryRun: true,
    skipPreflight: true,
    skipK6: true,
  });
  assert.equal(result.event, 'calibration_pilot_dry_run');
  assert.deepEqual(result.rates, [5, 10, 15]);
});

test('M7 #63 pilot logic stops at first failing SLO step (injected k6)', () => {
  const summary = parseK6SummaryFile(minimalPath);
  let call = 0;
  const result = runPilotLogic(
    {
      runId: 'mock-pilot',
      baseUrl: 'http://127.0.0.1:3000',
      startRate: 5,
      stepRate: 5,
      maxRate: 20,
      stepDuration: '30s',
      dryRun: false,
      skipPreflight: true,
      skipK6: false,
    },
    {
      hostPreflight: () => true,
      runK6: (rate) => {
        call += 1;
        return {
          summary: minimalPath,
          raw: minimalPath,
        };
      },
      evaluateStep: (s) => {
        const base = evaluateFromSummary(s);
        if (call >= 3) return { ...base, ok: false, reasons: ['terminal_booking_p99_above_limit'] };
        return base;
      },
    },
  );

  function evaluateFromSummary(s) {
    return {
      gate: 'calibration_slo',
      ok: true,
      terminal_booking_latency_p99_ms: 1,
      technical_error_rate: 0,
      dropped_arrival_rate: 0,
      generator: { ok: true },
      reasons: null,
    };
  }

  assert.equal(result.event, 'calibration_pilot_complete');
  assert.equal(result.slo_capacity_offered_rps, 10);
  assert.equal(result.steps.length, 3);
});
