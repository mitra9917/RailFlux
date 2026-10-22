/**
 * Load valid baseline/optimized pairs from campaign plan + result artifacts (M7 #66).
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  extractMetricValue,
  offeredRpsForLoadLevel,
} from './run-metrics.mjs';

function readJsonIfExists(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * @param {string} runsDir
 * @param {string} runId
 */
export function loadResultForRun(runsDir, runId) {
  const resultPath = path.join(runsDir, `${runId}.result.json`);
  return readJsonIfExists(resultPath);
}

/**
 * @param {object} campaignJson
 * @param {string} runsDir
 */
export function collectPrincipalPairs(campaignJson, runsDir) {
  const pairs = campaignJson?.plan?.pairs ?? [];
  /** @type {object[]} */
  const collected = [];

  for (const pair of pairs) {
    const manifests = pair.manifests ?? [];
    const baselineManifest = manifests.find((m) => m.architecture === 'baseline');
    const optimizedManifest = manifests.find((m) => m.architecture === 'optimized');
    if (!baselineManifest || !optimizedManifest) continue;

    const baselineResult = loadResultForRun(runsDir, baselineManifest.run_id);
    const optimizedResult = loadResultForRun(runsDir, optimizedManifest.run_id);
    if (!baselineResult || !optimizedResult) {
      collected.push({
        pair_id: pair.pair_id,
        cell_id: pair.cell_id,
        load_level: pair.load_level,
        status: 'missing_results',
        baseline_run_id: baselineManifest.run_id,
        optimized_run_id: optimizedManifest.run_id,
      });
      continue;
    }
    if (!baselineResult.valid || !optimizedResult.valid) {
      collected.push({
        pair_id: pair.pair_id,
        cell_id: pair.cell_id,
        load_level: pair.load_level,
        status: 'invalid_run',
        baseline_run_id: baselineManifest.run_id,
        optimized_run_id: optimizedManifest.run_id,
        baseline_valid: baselineResult.valid,
        optimized_valid: optimizedResult.valid,
      });
      continue;
    }

    collected.push({
      pair_id: pair.pair_id,
      cell_id: pair.cell_id,
      load_level: pair.load_level,
      status: 'valid',
      baseline_run_id: baselineManifest.run_id,
      optimized_run_id: optimizedManifest.run_id,
      baseline_result: baselineResult,
      optimized_result: optimizedResult,
      duration_seconds: baselineManifest.experiment?.duration_seconds ?? 180,
      cohort_mix: pair.cohort_mix ?? baselineManifest.experiment?.cohort_mix,
    });
  }
  return collected;
}

/**
 * @param {object[]} pairRecords from collectPrincipalPairs
 * @param {string} metricId
 * @param {string} [hypothesesPath]
 */
export function metricPairsFromRecords(pairRecords, metricId, hypothesesPath) {
  /** @type {{ pair_id: string, cell_id: string, load_level: string, baseline: number, optimized: number }[]} */
  const out = [];
  for (const rec of pairRecords) {
    if (rec.status !== 'valid') continue;
    const offeredRps = offeredRpsForLoadLevel(rec.load_level, hypothesesPath);
    const ctx = {
      offered_rps: offeredRps,
      duration_seconds: rec.duration_seconds,
    };
    const baseline = extractMetricValue(rec.baseline_result, metricId, ctx);
    const optimized = extractMetricValue(rec.optimized_result, metricId, ctx);
    if (!Number.isFinite(baseline) || !Number.isFinite(optimized)) continue;
    out.push({
      pair_id: rec.pair_id,
      cell_id: rec.cell_id,
      load_level: rec.load_level,
      baseline,
      optimized,
    });
  }
  return out;
}
