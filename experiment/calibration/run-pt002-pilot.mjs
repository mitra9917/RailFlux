#!/usr/bin/env node
/**
 * Stepped PT-002 calibration pilot on baseline (M7 #63).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  deriveSloCapacityFromSteps,
  evaluateCalibrationStep,
} from './calibration-slo.mjs';
import { parseK6SummaryFile } from '../controller/k6-summary-metrics.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const K6_SCRIPT = path.join(REPO_ROOT, 'load-tests/k6/pt-002-calibration-step.js');
const RESULTS = path.join(REPO_ROOT, 'load-tests/results');
const PILOTS = path.join(REPO_ROOT, 'experiment/calibration/pilots');

function parseArgs(argv) {
  /** @type {Record<string, string | boolean | number>} */
  const out = {
    runId: '',
    baseUrl: process.env.BASE_URL || 'http://127.0.0.1:3000',
    startRate: Number(process.env.PT002_START_RATE || 5),
    stepRate: Number(process.env.PT002_STEP_RATE || 5),
    maxRate: Number(process.env.PT002_MAX_RATE || 40),
    stepDuration: process.env.PT002_STEP_DURATION || '60s',
    dryRun: false,
    skipPreflight: false,
    skipK6: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--run-id' && argv[i + 1]) out.runId = argv[++i];
    else if (a === '--base-url' && argv[i + 1]) out.baseUrl = argv[++i];
    else if (a === '--start-rate' && argv[i + 1]) out.startRate = Number(argv[++i]);
    else if (a === '--step-rate' && argv[i + 1]) out.stepRate = Number(argv[++i]);
    else if (a === '--max-rate' && argv[i + 1]) out.maxRate = Number(argv[++i]);
    else if (a === '--step-duration' && argv[i + 1]) out.stepDuration = argv[++i];
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--skip-preflight') out.skipPreflight = true;
    else if (a === '--skip-k6') out.skipK6 = true;
  }
  if (!out.runId) {
    out.runId = `pt002-${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}Z`;
  }
  return out;
}

function buildRatePlan(start, step, max) {
  /** @type {number[]} */
  const rates = [];
  for (let r = start; r <= max; r += step) rates.push(r);
  return rates;
}

function runHostPreflight(baseUrl) {
  const res = spawnSync(
    'node',
    [path.join(REPO_ROOT, 'load-tests/scripts/generator-preflight.mjs'), 'host', '--base-url', baseUrl],
    { encoding: 'utf8', cwd: REPO_ROOT },
  );
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  return res.status === 0;
}

function resolveAuth() {
  if (process.env.K6_BEARER_TOKEN) {
    return {
      token: process.env.K6_BEARER_TOKEN,
      userId: process.env.K6_USER_ID || '',
    };
  }
  const secret = process.env.SYNTHETIC_JWT_SECRET || 'dev-only-change-me';
  const userId = process.env.K6_USER_ID || '11111111-1111-4111-8111-111111111111';
  const res = spawnSync(
    'node',
    [path.join(REPO_ROOT, 'scripts/mint-synthetic-jwt.mjs'), userId, 'browser'],
    { encoding: 'utf8', cwd: REPO_ROOT, env: { ...process.env, SYNTHETIC_JWT_SECRET: secret } },
  );
  if (res.status !== 0) {
    throw new Error(res.stderr || 'mint JWT failed');
  }
  return { token: res.stdout.trim(), userId };
}

function runK6Step(opts) {
  const summary = path.join(RESULTS, `pt-002-${opts.runId}-r${opts.rate}-summary.json`);
  const raw = path.join(RESULTS, `pt-002-${opts.runId}-r${opts.rate}-raw.ndjson`);
  /** @type {string[]} */
  const args = [
    'run',
    '--env',
    `BASE_URL=${opts.baseUrl}`,
    '--env',
    `RUN_ID=${opts.runId}-r${opts.rate}`,
    '--env',
    `K6_BEARER_TOKEN=${opts.token}`,
    '--env',
    `PT002_RATE=${opts.rate}`,
    '--env',
    `PT002_STEP_DURATION=${opts.stepDuration}`,
  ];
  if (opts.userId) {
    args.push('--env', `K6_USER_ID=${opts.userId}`);
  }
  args.push(
    '--summary-export',
    summary,
    '--out',
    `json=${raw}`,
    K6_SCRIPT,
  );
  const res = spawnSync('k6', args, { encoding: 'utf8', cwd: REPO_ROOT, stdio: 'inherit' });
  if (res.status !== 0) {
    throw new Error(`k6 failed at rate ${opts.rate} (exit ${res.status})`);
  }
  return { summary, raw };
}

export function runPilotLogic(options, deps = {}) {
  const rates = buildRatePlan(options.startRate, options.stepRate, options.maxRate);
  /** @type {{ rate_rps: number, slo: ReturnType<typeof evaluateCalibrationStep>, artifacts?: { summary: string, raw: string } }[]} */
  const steps = [];

  const evaluate = deps.evaluateStep || ((summary) => evaluateCalibrationStep(summary));
  const hostPreflight = deps.hostPreflight || (() => runHostPreflight(options.baseUrl));
  const k6Step =
    deps.runK6 || ((rate, token, uid) => runK6Step({ ...options, rate, token, userId: uid }));

  if (options.dryRun) {
    return {
      event: 'calibration_pilot_dry_run',
      run_id: options.runId,
      rates,
      step_duration: options.stepDuration,
    };
  }

  if (!options.skipPreflight && !hostPreflight()) {
    return { event: 'calibration_pilot_failed', reason: 'generator_preflight_failed', run_id: options.runId };
  }

  let token = '';
  let userId = '';
  if (!options.skipK6) {
    if (!deps.runK6 && spawnSync('k6', ['version'], { encoding: 'utf8' }).status !== 0) {
      return { event: 'calibration_pilot_failed', reason: 'k6_missing', run_id: options.runId };
    }
    const auth = resolveAuth();
    token = auth.token;
    userId = auth.userId;
  }

  for (const rate of rates) {
    if (!options.skipPreflight && !hostPreflight()) {
      return {
        event: 'calibration_pilot_failed',
        reason: 'generator_preflight_failed_mid_pilot',
        run_id: options.runId,
        steps,
      };
    }

    let summaryPath = '';
    let rawPath = '';
    if (options.skipK6) {
      throw new Error('skip-k6 requires injected runK6 in deps (tests only)');
    }
    const artifacts = k6Step(rate, token, userId);
    summaryPath = artifacts.summary;
    rawPath = artifacts.raw;

    const summary = parseK6SummaryFile(summaryPath);
    const slo = evaluate(summary);
    steps.push({
      rate_rps: rate,
      slo,
      artifacts: { summary: summaryPath, raw: rawPath },
    });
    if (!slo.ok) break;
  }

  const { slo_capacity_offered_rps, first_failing_rate_rps } = deriveSloCapacityFromSteps(steps);
  return {
    event: 'calibration_pilot_complete',
    test_id: 'PT-002',
    run_id: options.runId,
    base_url: options.baseUrl,
    step_duration: options.stepDuration,
    steps,
    slo_capacity_offered_rps,
    first_failing_rate_rps,
    complete: slo_capacity_offered_rps > 0,
    finalized_at: new Date().toISOString(),
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  fs.mkdirSync(RESULTS, { recursive: true });
  fs.mkdirSync(PILOTS, { recursive: true });

  const result = runPilotLogic(options);
  if (result.event === 'calibration_pilot_dry_run') {
    console.log(JSON.stringify(result));
    process.exit(0);
  }
  if (result.event === 'calibration_pilot_failed') {
    console.log(JSON.stringify(result));
    process.exit(1);
  }

  const pilotPath = path.join(PILOTS, `${options.runId}.json`);
  const pilotRel = path.relative(REPO_ROOT, pilotPath);
  const payload = { ...result, pilot_artifact: pilotRel };
  fs.writeFileSync(pilotPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify(payload));

  process.exit(result.complete ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (err) {
    console.error(JSON.stringify({ event: 'calibration_pilot_error', message: String(err.message ?? err) }));
    process.exit(1);
  }
}
