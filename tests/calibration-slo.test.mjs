import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  deriveSloCapacityFromSteps,
  evaluateCalibrationStep,
  progressiveLoadRates,
  PRIMARY_SLO,
} from '../experiment/calibration/calibration-slo.mjs';

const root = join(import.meta.dirname, '..');
const minimal = JSON.parse(
  readFileSync(join(root, 'tests/fixtures/k6-summary-minimal.json'), 'utf8'),
);

test('M7 #63 calibration SLO passes minimal k6 summary', () => {
  const result = evaluateCalibrationStep(minimal);
  assert.equal(result.ok, true);
  assert.ok(result.terminal_booking_latency_p99_ms <= PRIMARY_SLO.terminal_latency_p99_ms_max);
});

test('M7 #63 calibration SLO uses k6 http_req_failed value field', () => {
  const summary = {
    metrics: {
      ...minimal.metrics,
      http_req_failed: { passes: 27, fails: 274, value: 0.089701 },
      'http_req_duration{op:booking}': { 'p(99)': 50 },
    },
  };
  const result = evaluateCalibrationStep(summary);
  assert.ok(Math.abs(result.technical_error_rate - 0.089701) < 0.0001);
  assert.equal(result.ok, false);
  assert.ok(result.reasons?.includes('technical_error_rate_above_limit'));
});

test('M7 #63 calibration SLO fails high booking p99', () => {
  const summary = {
    metrics: {
      ...minimal.metrics,
      'http_req_duration{op:booking}': { 'p(99)': 2500 },
      http_req_failed: { rate: 0, fails: 0, count: 100 },
    },
  };
  const result = evaluateCalibrationStep(summary);
  assert.equal(result.ok, false);
  assert.ok(result.reasons?.includes('terminal_booking_p99_above_limit'));
});

test('M7 #63 deriveSloCapacityFromSteps picks last passing rate', () => {
  const steps = [
    { rate_rps: 5, slo: { ok: true } },
    { rate_rps: 10, slo: { ok: true } },
    { rate_rps: 15, slo: { ok: false } },
  ];
  const cap = deriveSloCapacityFromSteps(steps);
  assert.equal(cap.slo_capacity_offered_rps, 10);
  assert.equal(cap.first_failing_rate_rps, 15);
});

test('M7 #63 progressive load rates from capacity', () => {
  const p = progressiveLoadRates(20);
  assert.equal(p.pct_50, 10);
  assert.equal(p.pct_80, 16);
  assert.equal(p.pct_110, 22);
});
