#!/usr/bin/env node
/**
 * Freeze calibrated rates into experiment/hypotheses.yaml (M7 #63).
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { progressiveLoadRates } from './calibration-slo.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const DEFAULT_HYP = path.join(REPO_ROOT, 'experiment/hypotheses.yaml');

function parseArgs(argv) {
  /** @type {{ pilot: string, hypotheses: string, dryRun: boolean }} */
  const out = { pilot: '', hypotheses: DEFAULT_HYP, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--pilot' && argv[i + 1]) out.pilot = argv[++i];
    else if (argv[i] === '--hypotheses' && argv[i + 1]) out.hypotheses = path.resolve(argv[++i]);
    else if (argv[i] === '--dry-run') out.dryRun = true;
  }
  return out;
}

/**
 * @param {object} pilot
 */
export function buildCalibrationYamlBlock(pilot) {
  const capacity = Number(pilot.slo_capacity_offered_rps || 0);
  const progressive = progressiveLoadRates(capacity);
  const lines = [
    'calibration:',
    `  frozen_at: "${pilot.finalized_at || new Date().toISOString()}"`,
    `  pilot_run_id: "${pilot.run_id}"`,
    '  deployment_profile: baseline',
    '  test_id: PT-002',
    '  workload_mix:',
    '    search: 0.7',
    '    availability: 0.2',
    '    booking: 0.1',
    `  slo_capacity_offered_rps: ${capacity}`,
    '  progressive_load_rps:',
    `    pct_50: ${progressive.pct_50}`,
    `    pct_80: ${progressive.pct_80}`,
    `    pct_110: ${progressive.pct_110}`,
    `  step_duration: "${pilot.step_duration || '60s'}"`,
    `  pilot_artifact: "${pilot.pilot_artifact || ''}"`,
  ];
  return lines.join('\n');
}

/**
 * @param {string} text
 * @param {string} calibrationBlock
 */
export function patchHypothesesText(text, calibrationBlock) {
  let out = text.replace(/^status:\s*.+$/m, 'status: frozen');
  if (/^calibration:\s*$/m.test(out) || /^calibration:\n/m.test(out)) {
    out = out.replace(/^calibration:[\s\S]*?(?=^hypotheses:)/m, `${calibrationBlock}\n`);
  } else {
    out = out.replace(/^hypotheses:/m, `${calibrationBlock}\n\nhypotheses:`);
  }
  return out;
}

function main() {
  const { pilot, hypotheses, dryRun } = parseArgs(process.argv.slice(2));
  if (!pilot || !fs.existsSync(pilot)) {
    console.error('Usage: freeze-hypotheses.mjs --pilot PATH/to/pilot.json [--hypotheses PATH] [--dry-run]');
    process.exit(2);
  }
  const pilotData = JSON.parse(fs.readFileSync(pilot, 'utf8'));
  if (!pilotData.slo_capacity_offered_rps || pilotData.slo_capacity_offered_rps <= 0) {
    console.error(
      JSON.stringify({
        event: 'freeze_hypotheses_failed',
        reason: 'no_passing_slo_capacity',
        pilot: path.resolve(pilot),
      }),
    );
    process.exit(1);
  }
  pilotData.pilot_artifact = path.relative(REPO_ROOT, path.resolve(pilot));
  const block = buildCalibrationYamlBlock(pilotData);
  const before = fs.readFileSync(hypotheses, 'utf8');
  const after = patchHypothesesText(before, block);
  if (dryRun) {
    console.log(after);
    process.exit(0);
  }
  fs.writeFileSync(hypotheses, after, 'utf8');
  console.log(
    JSON.stringify({
      event: 'hypotheses_frozen',
      hypotheses: hypotheses,
      slo_capacity_offered_rps: pilotData.slo_capacity_offered_rps,
    }),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
