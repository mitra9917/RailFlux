import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  buildCalibrationYamlBlock,
  patchHypothesesText,
} from '../experiment/calibration/freeze-hypotheses.mjs';

const root = join(import.meta.dirname, '..');

test('M7 #63 freeze builds calibration block with progressive loads', () => {
  const block = buildCalibrationYamlBlock({
    run_id: 'cal-001',
    slo_capacity_offered_rps: 20,
    step_duration: '60s',
    finalized_at: '2026-04-01T00:00:00.000Z',
    pilot_artifact: 'experiment/calibration/pilots/cal-001.json',
  });
  assert.match(block, /slo_capacity_offered_rps: 20/);
  assert.match(block, /pct_80: 16/);
});

test('M7 #63 patchHypothesesText sets frozen status and inserts calibration', () => {
  const before = readFileSync(join(root, 'experiment/hypotheses.yaml'), 'utf8');
  const block = buildCalibrationYamlBlock({
    run_id: 'cal-test',
    slo_capacity_offered_rps: 15,
    step_duration: '60s',
    pilot_artifact: 'experiment/calibration/pilots/cal-test.json',
  });
  const after = patchHypothesesText(before, block);
  assert.match(after, /^status: frozen/m);
  assert.match(after, /^calibration:/m);
  assert.match(after, /slo_capacity_offered_rps: 15/);
  assert.match(after, /^hypotheses:/m);
});
